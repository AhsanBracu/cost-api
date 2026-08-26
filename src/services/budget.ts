import { z } from "zod";
import { Types } from "mongoose";
import { CategoryBudget, MonthlySpendLimit } from "../models/BudgetModel";
import Category from "../models/CategoryModel";
import Cost from "../models/CostModel";
import { NotFoundError, ValidationError } from "../errors/AppError";
import { setCategoryBudgetSchema, setMonthlyLimitSchema } from "../schemas/budget.schema";
import { resolveFamilyId, assertOptionalFamilyMember } from "./familyContext";
import ActivityLogService from "./activityLog";

type SetCategoryBudgetInput = z.infer<typeof setCategoryBudgetSchema>;
type SetMonthlyLimitInput = z.infer<typeof setMonthlyLimitSchema>;

const MAX_TREND_MONTHS = 36;

const previousMonthOf = (year: number, month: number) =>
    month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };

const assertValidCategory = async (familyId: string, category: string) => {
    const exists = await Category.findOne({ family: familyId, name: category });
    if (!exists)
        throw new ValidationError(`"${category}" is not one of your categories`);
};

/** Normalises an optional member into the value stored on the document. */
const memberKey = (member: string | null | undefined) => member ?? null;

/**
 * A month with no budgets inherits the previous month's, since budgets rarely
 * change month to month. Copies are ordinary rows -- edit or delete them
 * freely. Only looks one month back, so a gap doesn't silently pull forward a
 * budget from long ago. Seeding is per member, so one person's budgets
 * carrying over doesn't imply anyone else's did.
 */
const seedFromPreviousMonth = async (
    familyId: string,
    member: string | null,
    year: number,
    month: number
) => {
    const previous = previousMonthOf(year, month);

    const [previousBudgets, previousLimit] = await Promise.all([
        CategoryBudget.find({ family: familyId, member, year: previous.year, month: previous.month }),
        MonthlySpendLimit.findOne({ family: familyId, member, year: previous.year, month: previous.month }),
    ]);

    if (previousBudgets.length > 0) {
        await CategoryBudget.insertMany(
            previousBudgets.map((b) => ({
                family: familyId,
                member,
                year,
                month,
                category: b.category,
                amount: b.amount,
                currency: b.currency,
            }))
        );
    }

    if (previousLimit) {
        await MonthlySpendLimit.create({
            family: familyId,
            member,
            year,
            month,
            amount: previousLimit.amount,
            currency: previousLimit.currency,
        });
    }
};

/**
 * Spend that a budget is measured against. A household budget covers every
 * cost in the family; a member's budget covers what was spent *on* them
 * (forWhom), which is what a personal allowance means.
 */
const getMonthSpendByCategory = async (
    familyId: string,
    member: string | null,
    year: number,
    month: number
) => {
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const match: Record<string, unknown> = {
        family: new Types.ObjectId(familyId),
        isDeleted: false,
        date: { $gte: monthStart, $lte: monthEnd },
    };
    if (member)
        match.forWhom = new Types.ObjectId(member);

    return Cost.aggregate([
        { $match: match },
        { $group: { _id: { category: "$category", currency: "$currency" }, spent: { $sum: "$amount" } } },
        { $project: { _id: 0, category: "$_id.category", currency: "$_id.currency", spent: 1 } },
    ]);
};

const BudgetService = {
    getBudgets: async (userId: string, year: number, month: number, member?: string | null) => {
        const familyId = await resolveFamilyId(userId);
        await assertOptionalFamilyMember(familyId, member, "member");
        const scope = memberKey(member);

        const existing = await CategoryBudget.find({ family: familyId, member: scope, year, month });
        const existingLimit = await MonthlySpendLimit.findOne({ family: familyId, member: scope, year, month });

        if (existing.length === 0 && !existingLimit)
            await seedFromPreviousMonth(familyId, scope, year, month);

        const [budgets, limit] = await Promise.all([
            CategoryBudget.find({ family: familyId, member: scope, year, month }).sort({ category: 1 }),
            MonthlySpendLimit.findOne({ family: familyId, member: scope, year, month }),
        ]);

        return { year, month, member: scope, budgets, monthlyLimit: limit };
    },

    setCategoryBudget: async (userId: string, data: SetCategoryBudgetInput) => {
        const familyId = await resolveFamilyId(userId);
        await assertValidCategory(familyId, data.category);
        await assertOptionalFamilyMember(familyId, data.member, "member");
        const scope = memberKey(data.member);

        // Upsert rather than create -- setting a budget that already exists
        // should update it, not fail.
        const budget = await CategoryBudget.findOneAndUpdate(
            { family: familyId, member: scope, year: data.year, month: data.month, category: data.category },
            { $set: { amount: data.amount, currency: data.currency } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "updated",
            entity: "budget",
            entityId: budget?._id as string,
            summary: `Set the ${scope ? "personal" : "household"} ${data.category} budget to ${data.amount} ${data.currency}`,
        });

        return budget;
    },

    deleteCategoryBudget: async (userId: string, budgetId: string) => {
        const familyId = await resolveFamilyId(userId);
        const budget = await CategoryBudget.findOneAndDelete({ _id: budgetId, family: familyId });
        if (!budget)
            throw new NotFoundError("Budget not found");

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "deleted",
            entity: "budget",
            entityId: budget._id as string,
            summary: `Removed the ${budget.category} budget`,
        });
    },

    setMonthlyLimit: async (userId: string, data: SetMonthlyLimitInput) => {
        const familyId = await resolveFamilyId(userId);
        await assertOptionalFamilyMember(familyId, data.member, "member");
        const scope = memberKey(data.member);

        const limit = await MonthlySpendLimit.findOneAndUpdate(
            { family: familyId, member: scope, year: data.year, month: data.month },
            { $set: { amount: data.amount, currency: data.currency } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "updated",
            entity: "monthlyLimit",
            entityId: limit?._id as string,
            summary: `Set the ${scope ? "personal" : "household"} monthly limit to ${data.amount} ${data.currency}`,
        });

        return limit;
    },

    deleteMonthlyLimit: async (userId: string, year: number, month: number, member?: string | null) => {
        const familyId = await resolveFamilyId(userId);
        await assertOptionalFamilyMember(familyId, member, "member");
        const scope = memberKey(member);

        const limit = await MonthlySpendLimit.findOneAndDelete({ family: familyId, member: scope, year, month });
        if (!limit)
            throw new NotFoundError("Monthly limit not set");

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "deleted",
            entity: "monthlyLimit",
            entityId: limit._id as string,
            summary: `Removed the ${scope ? "personal" : "household"} monthly limit`,
        });
    },

    getBudgetSummary: async (userId: string, year: number, month: number, member?: string | null) => {
        const familyId = await resolveFamilyId(userId);
        const { budgets, monthlyLimit, member: scope } = await BudgetService.getBudgets(userId, year, month, member);
        const spendRows = await getMonthSpendByCategory(familyId, scope, year, month);

        // Include categories that were spent on but never budgeted -- unplanned
        // spending is exactly what a budget view should surface.
        const keys = new Set([
            ...budgets.map((b) => `${b.category}|${b.currency}`),
            ...spendRows.map((s: { category: string; currency: string }) => `${s.category}|${s.currency}`),
        ]);

        const categories = Array.from(keys).sort().map((key) => {
            const [category, currency] = key.split("|");
            const budgeted = budgets.find((b) => b.category === category && b.currency === currency)?.amount ?? 0;
            const spent = spendRows.find(
                (s: { category: string; currency: string; spent: number }) => s.category === category && s.currency === currency
            )?.spent ?? 0;

            return {
                category,
                currency,
                budgeted,
                spent,
                remaining: budgeted - spent,
                percentUsed: budgeted === 0 ? null : Math.round((spent / budgeted) * 10000) / 100,
            };
        });

        let overall = null;
        const warnings: string[] = [];

        if (monthlyLimit) {
            const spent = spendRows
                .filter((s: { currency: string }) => s.currency === monthlyLimit.currency)
                .reduce((sum: number, s: { spent: number }) => sum + s.spent, 0);

            const now = new Date();
            const daysInMonth = new Date(year, month, 0).getDate();
            const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
            // Past months have no days left to pace; future months get the whole month.
            const daysRemaining = isCurrentMonth
                ? daysInMonth - now.getDate() + 1
                : now > new Date(year, month, 0) ? 0 : daysInMonth;

            const remaining = monthlyLimit.amount - spent;

            overall = {
                currency: monthlyLimit.currency,
                limit: monthlyLimit.amount,
                spent,
                remaining,
                percentUsed: monthlyLimit.amount === 0 ? null : Math.round((spent / monthlyLimit.amount) * 10000) / 100,
                daysRemaining,
                dailyPace: daysRemaining > 0 ? Math.round((Math.max(remaining, 0) / daysRemaining) * 100) / 100 : null,
            };

            const budgetedInLimitCurrency = budgets
                .filter((b) => b.currency === monthlyLimit.currency)
                .reduce((sum, b) => sum + b.amount, 0);

            if (budgetedInLimitCurrency > monthlyLimit.amount) {
                warnings.push(
                    `Category budgets total ${budgetedInLimitCurrency} ${monthlyLimit.currency}, which exceeds the monthly limit of ${monthlyLimit.amount} ${monthlyLimit.currency}.`
                );
            }
        }

        return { year, month, member: scope, categories, overall, warnings };
    },
};

export { MAX_TREND_MONTHS };
export default BudgetService;
