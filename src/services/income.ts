import { z } from "zod";
import Income from "../models/IncomeModel";
import { NotFoundError, ConflictError } from "../errors/AppError";
import { createIncomeSchema, updateIncomeSchema, listIncomeQuerySchema } from "../schemas/income.schema";
import { resolveFamilyId, assertFamilyMember } from "./familyContext";
import ActivityLogService from "./activityLog";

type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;
type ListIncomeQuery = z.infer<typeof listIncomeQuerySchema>;

const monthLabel = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

const IncomeService = {
    createIncome: async (userId: string, data: CreateIncomeInput) => {
        const familyId = await resolveFamilyId(userId);

        const earnedBy = data.earnedBy ?? userId;
        await assertFamilyMember(familyId, earnedBy, "earnedBy");

        // Uniqueness is per earner, not per month: a household with two
        // salaries records two rows for the same month.
        const existing = await Income.findOne({
            family: familyId,
            year: data.year,
            month: data.month,
            earnedBy,
        });
        if (existing)
            throw new ConflictError("Income for that person is already recorded for this month");

        const income = await Income.create({
            ...data,
            family: familyId,
            createdBy: userId,
            earnedBy,
        });

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "created",
            entity: "income",
            entityId: income._id as string,
            summary: `Recorded income of ${income.amount} ${income.currency} for ${monthLabel(data.year, data.month)}`,
        });

        return income;
    },

    listIncome: async (userId: string, query: ListIncomeQuery) => {
        const familyId = await resolveFamilyId(userId);
        const filter: Record<string, unknown> = { family: familyId };
        if (query.year !== undefined)
            filter.year = query.year;
        if (query.month !== undefined)
            filter.month = query.month;
        if (query.earnedBy)
            filter.earnedBy = query.earnedBy;

        return Income.find(filter)
            .sort({ year: -1, month: -1 })
            .populate("earnedBy", "name email");
    },

    getIncome: async (userId: string, incomeId: string) => {
        const familyId = await resolveFamilyId(userId);
        const income = await Income.findOne({ _id: incomeId, family: familyId });
        if (!income)
            throw new NotFoundError("Income not found");

        return income;
    },

    updateIncome: async (userId: string, incomeId: string, data: UpdateIncomeInput) => {
        const familyId = await resolveFamilyId(userId);
        const income = await Income.findOne({ _id: incomeId, family: familyId });
        if (!income)
            throw new NotFoundError("Income not found");

        if (data.earnedBy)
            await assertFamilyMember(familyId, data.earnedBy, "earnedBy");

        Object.assign(income, data);
        await income.save();

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "updated",
            entity: "income",
            entityId: income._id as string,
            summary: `Updated income to ${income.amount} ${income.currency} for ${monthLabel(income.year, income.month)}`,
        });

        return income;
    },

    deleteIncome: async (userId: string, incomeId: string) => {
        const familyId = await resolveFamilyId(userId);
        const income = await Income.findOneAndDelete({ _id: incomeId, family: familyId });
        if (!income)
            throw new NotFoundError("Income not found");

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "deleted",
            entity: "income",
            entityId: income._id as string,
            summary: `Deleted income of ${income.amount} ${income.currency} for ${monthLabel(income.year, income.month)}`,
        });
    },
};

export default IncomeService;
