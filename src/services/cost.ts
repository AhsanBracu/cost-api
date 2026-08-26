import { z } from "zod";
import Cost from "../models/CostModel";
import Category from "../models/CategoryModel";
import { NotFoundError, ValidationError } from "../errors/AppError";
import { createCostSchema, updateCostSchema, listCostsQuerySchema } from "../schemas/cost.schema";
import { resolveFamilyId, assertFamilyMember, assertOptionalFamilyMember } from "./familyContext";
import ActivityLogService from "./activityLog";

type CreateCostInput = z.infer<typeof createCostSchema>;
type UpdateCostInput = z.infer<typeof updateCostSchema>;
type ListCostsQuery = z.infer<typeof listCostsQuerySchema>;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// category is a free-text field validated against the family's Category list
// rather than a fixed enum -- see CategoryService for why (renaming or
// deleting a category shouldn't retroactively break past costs).
const assertValidCategory = async (familyId: string, category: string) => {
    const exists = await Category.findOne({ family: familyId, name: category });
    if (!exists)
        throw new ValidationError(`"${category}" is not one of your categories`);
};

const describe = (cost: { amount: number; currency: string; category: string; place?: string }) =>
    `${cost.category} cost of ${cost.amount} ${cost.currency}${cost.place ? ` at ${cost.place}` : ""}`;

const CostService = {
    createCost: async (userId: string, data: CreateCostInput, receiptUrl?: string) => {
        const familyId = await resolveFamilyId(userId);
        await assertValidCategory(familyId, data.category);

        // Unattributed spending defaults to the person entering it, and to a
        // shared household cost -- the common case in a family ledger.
        const paidBy = data.paidBy ?? userId;
        await assertFamilyMember(familyId, paidBy, "paidBy");
        await assertOptionalFamilyMember(familyId, data.forWhom, "forWhom");

        const cost = await Cost.create({
            ...data,
            family: familyId,
            createdBy: userId,
            paidBy,
            forWhom: data.forWhom ?? null,
            receiptUrl,
        });

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "created",
            entity: "cost",
            entityId: cost._id as string,
            summary: `Added ${describe(cost)}`,
        });

        return cost;
    },

    getCost: async (userId: string, costId: string) => {
        const familyId = await resolveFamilyId(userId);
        const cost = await Cost.findOne({ _id: costId, family: familyId, isDeleted: false });
        if (!cost)
            throw new NotFoundError("Cost not found");

        return cost;
    },

    listCosts: async (userId: string, query: ListCostsQuery) => {
        const familyId = await resolveFamilyId(userId);
        const filter: Record<string, unknown> = { family: familyId, isDeleted: false };

        if (query.paidBy)
            filter.paidBy = query.paidBy;

        // "shared" selects household costs, which are stored as a null forWhom.
        if (query.forWhom)
            filter.forWhom = query.forWhom === "shared" ? null : query.forWhom;

        if (query.category)
            filter.category = query.category;

        if (query.paymentMethod)
            filter.paymentMethod = query.paymentMethod;

        if (query.place)
            filter.place = { $regex: escapeRegex(query.place), $options: "i" };

        if (query.minAmount !== undefined || query.maxAmount !== undefined) {
            filter.amount = {
                ...(query.minAmount !== undefined && { $gte: query.minAmount }),
                ...(query.maxAmount !== undefined && { $lte: query.maxAmount }),
            };
        }

        if (query.startDate || query.endDate) {
            filter.date = {
                ...(query.startDate && { $gte: query.startDate }),
                ...(query.endDate && { $lte: query.endDate }),
            };
        }

        if (query.search) {
            const regex = { $regex: escapeRegex(query.search), $options: "i" };
            filter.$or = [{ description: regex }, { place: regex }, { notes: regex }];
        }

        const sort: Record<string, 1 | -1> = { [query.sortBy]: query.sortOrder === "asc" ? 1 : -1 };
        const skip = (query.page - 1) * query.limit;

        const [items, total] = await Promise.all([
            Cost.find(filter).sort(sort).skip(skip).limit(query.limit),
            Cost.countDocuments(filter),
        ]);

        return {
            items,
            total,
            page: query.page,
            limit: query.limit,
            totalPages: Math.ceil(total / query.limit),
        };
    },

    updateCost: async (userId: string, costId: string, data: UpdateCostInput, receiptUrl?: string) => {
        const familyId = await resolveFamilyId(userId);
        const cost = await Cost.findOne({ _id: costId, family: familyId, isDeleted: false });
        if (!cost)
            throw new NotFoundError("Cost not found");

        if (data.category)
            await assertValidCategory(familyId, data.category);
        if (data.paidBy)
            await assertFamilyMember(familyId, data.paidBy, "paidBy");
        if (data.forWhom !== undefined)
            await assertOptionalFamilyMember(familyId, data.forWhom, "forWhom");

        Object.assign(cost, data);
        if (receiptUrl)
            cost.receiptUrl = receiptUrl;

        await cost.save();

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "updated",
            entity: "cost",
            entityId: cost._id as string,
            summary: `Edited ${describe(cost)}`,
        });

        return cost;
    },

    deleteCost: async (userId: string, costId: string) => {
        const familyId = await resolveFamilyId(userId);
        const cost = await Cost.findOne({ _id: costId, family: familyId, isDeleted: false });
        if (!cost)
            throw new NotFoundError("Cost not found");

        cost.isDeleted = true;
        cost.deletedAt = new Date();
        await cost.save();

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "deleted",
            entity: "cost",
            entityId: cost._id as string,
            summary: `Deleted ${describe(cost)}`,
        });
    },

    restoreCost: async (userId: string, costId: string) => {
        const familyId = await resolveFamilyId(userId);
        const cost = await Cost.findOne({ _id: costId, family: familyId, isDeleted: true });
        if (!cost)
            throw new NotFoundError("Deleted cost not found");

        cost.isDeleted = false;
        cost.deletedAt = undefined;
        await cost.save();

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "restored",
            entity: "cost",
            entityId: cost._id as string,
            summary: `Restored ${describe(cost)}`,
        });
    },
};

export default CostService;
