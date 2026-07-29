import { z } from "zod";
import Cost from "../models/CostModel";
import { NotFoundError } from "../errors/AppError";
import { createCostSchema, updateCostSchema, listCostsQuerySchema } from "../schemas/cost.schema";

type CreateCostInput = z.infer<typeof createCostSchema>;
type UpdateCostInput = z.infer<typeof updateCostSchema>;
type ListCostsQuery = z.infer<typeof listCostsQuerySchema>;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CostService = {
    createCost: async (userId: string, data: CreateCostInput, receiptUrl?: string) => {
        return Cost.create({ ...data, user: userId, receiptUrl });
    },

    getCost: async (userId: string, costId: string) => {
        const cost = await Cost.findOne({ _id: costId, user: userId, isDeleted: false });
        if (!cost)
            throw new NotFoundError("Cost not found");

        return cost;
    },

    listCosts: async (userId: string, query: ListCostsQuery) => {
        const filter: Record<string, unknown> = { user: userId, isDeleted: false };

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
        const cost = await Cost.findOne({ _id: costId, user: userId, isDeleted: false });
        if (!cost)
            throw new NotFoundError("Cost not found");

        Object.assign(cost, data);
        if (receiptUrl)
            cost.receiptUrl = receiptUrl;

        await cost.save();
        return cost;
    },

    deleteCost: async (userId: string, costId: string) => {
        const cost = await Cost.findOne({ _id: costId, user: userId, isDeleted: false });
        if (!cost)
            throw new NotFoundError("Cost not found");

        cost.isDeleted = true;
        cost.deletedAt = new Date();
        await cost.save();
    },

    restoreCost: async (userId: string, costId: string) => {
        const cost = await Cost.findOne({ _id: costId, user: userId, isDeleted: true });
        if (!cost)
            throw new NotFoundError("Deleted cost not found");

        cost.isDeleted = false;
        cost.deletedAt = undefined;
        await cost.save();
    },
};

export default CostService;
