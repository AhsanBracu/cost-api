import { z } from "zod";
import { Types } from "mongoose";
import SavingsGoal from "../models/SavingsGoalModel";
import Income from "../models/IncomeModel";
import Cost from "../models/CostModel";
import { NotFoundError, ValidationError } from "../errors/AppError";
import { createSavingsGoalSchema, updateSavingsGoalSchema, listSavingsGoalsQuerySchema } from "../schemas/savingsGoal.schema";
import { resolveFamilyId, assertOptionalFamilyMember } from "./familyContext";
import ActivityLogService from "./activityLog";

type CreateSavingsGoalInput = z.infer<typeof createSavingsGoalSchema>;
type UpdateSavingsGoalInput = z.infer<typeof updateSavingsGoalSchema>;
type ListSavingsGoalsQuery = z.infer<typeof listSavingsGoalsQuerySchema>;

const MAX_TREND_MONTHS = 36;

const memberKey = (member: string | null | undefined) => member ?? null;

/**
 * With no member, this is the household picture: every earner's income, all
 * family spending, all goals. With a member it becomes that person's own
 * savings view -- their income, what was spent on them, and their own goals.
 */
const computeMonthBreakdown = async (
    familyId: string,
    year: number,
    month: number,
    member?: string | null
) => {
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const incomeMatch: Record<string, unknown> = { family: new Types.ObjectId(familyId), year, month };
    const costMatch: Record<string, unknown> = {
        family: new Types.ObjectId(familyId),
        isDeleted: false,
        date: { $gte: monthStart, $lte: monthEnd },
    };
    const goalFilter: Record<string, unknown> = { family: familyId, year, month };

    if (member) {
        incomeMatch.earnedBy = new Types.ObjectId(member);
        costMatch.forWhom = new Types.ObjectId(member);
        goalFilter.member = member;
    }

    const [incomeTotals, goals, costTotals] = await Promise.all([
        // A household can have several earners, so income is summed per
        // currency rather than read from a single row.
        Income.aggregate([
            { $match: incomeMatch },
            { $group: { _id: "$currency", total: { $sum: "$amount" } } },
            { $project: { _id: 0, currency: "$_id", total: 1 } },
        ]),
        SavingsGoal.find(goalFilter),
        Cost.aggregate([
            { $match: costMatch },
            { $group: { _id: "$currency", total: { $sum: "$amount" } } },
            { $project: { _id: 0, currency: "$_id", total: 1 } },
        ]),
    ]);

    const goalTotalsByCurrency: Record<string, number> = {};
    for (const goal of goals)
        goalTotalsByCurrency[goal.currency] = (goalTotalsByCurrency[goal.currency] ?? 0) + goal.targetAmount;

    const currencies = new Set([
        ...incomeTotals.map((i: { currency: string }) => i.currency),
        ...costTotals.map((c: { currency: string }) => c.currency),
        ...Object.keys(goalTotalsByCurrency),
    ]);

    const breakdown = Array.from(currencies).sort().map((currency) => {
        const income = incomeTotals.find((i: { currency: string; total: number }) => i.currency === currency)?.total ?? 0;
        const spent = costTotals.find((c: { currency: string; total: number }) => c.currency === currency)?.total ?? 0;
        const goalTotal = goalTotalsByCurrency[currency] ?? 0;
        const actualSaved = income - spent;
        const difference = actualSaved - goalTotal;

        return { currency, income, spent, actualSaved, goalTotal, difference };
    });

    return { goals, breakdown };
};

const enumerateMonths = (startYear: number, startMonth: number, endYear: number, endMonth: number) => {
    const months: { year: number; month: number }[] = [];
    let year = startYear;
    let month = startMonth;

    while (year < endYear || (year === endYear && month <= endMonth)) {
        months.push({ year, month });
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }

    return months;
};

const SavingsGoalService = {
    createGoal: async (userId: string, data: CreateSavingsGoalInput) => {
        const familyId = await resolveFamilyId(userId);
        await assertOptionalFamilyMember(familyId, data.member, "member");

        const goal = await SavingsGoal.create({
            ...data,
            family: familyId,
            createdBy: userId,
            member: memberKey(data.member),
        });

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "created",
            entity: "savingsGoal",
            entityId: goal._id as string,
            summary: `Added a savings goal "${goal.purpose}" of ${goal.targetAmount} ${goal.currency}`,
        });

        return goal;
    },

    listGoals: async (userId: string, query: ListSavingsGoalsQuery) => {
        const familyId = await resolveFamilyId(userId);
        const filter: Record<string, unknown> = { family: familyId };
        if (query.year !== undefined)
            filter.year = query.year;
        if (query.month !== undefined)
            filter.month = query.month;
        if (query.member !== undefined)
            filter.member = memberKey(query.member);

        return SavingsGoal.find(filter).sort({ year: -1, month: -1 }).populate("member", "name email");
    },

    getGoal: async (userId: string, goalId: string) => {
        const familyId = await resolveFamilyId(userId);
        const goal = await SavingsGoal.findOne({ _id: goalId, family: familyId });
        if (!goal)
            throw new NotFoundError("Savings goal not found");

        return goal;
    },

    updateGoal: async (userId: string, goalId: string, data: UpdateSavingsGoalInput) => {
        const familyId = await resolveFamilyId(userId);
        const goal = await SavingsGoal.findOne({ _id: goalId, family: familyId });
        if (!goal)
            throw new NotFoundError("Savings goal not found");

        if (data.member !== undefined)
            await assertOptionalFamilyMember(familyId, data.member, "member");

        Object.assign(goal, data);
        await goal.save();

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "updated",
            entity: "savingsGoal",
            entityId: goal._id as string,
            summary: `Updated the savings goal "${goal.purpose}"`,
        });

        return goal;
    },

    deleteGoal: async (userId: string, goalId: string) => {
        const familyId = await resolveFamilyId(userId);
        const goal = await SavingsGoal.findOneAndDelete({ _id: goalId, family: familyId });
        if (!goal)
            throw new NotFoundError("Savings goal not found");

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "deleted",
            entity: "savingsGoal",
            entityId: goal._id as string,
            summary: `Deleted the savings goal "${goal.purpose}"`,
        });
    },

    getSummary: async (userId: string, year: number, month: number, member?: string | null) => {
        const familyId = await resolveFamilyId(userId);
        await assertOptionalFamilyMember(familyId, member, "member");
        const { goals, breakdown } = await computeMonthBreakdown(familyId, year, month, member);
        return { year, month, member: memberKey(member), goals, breakdown };
    },

    getTrend: async (userId: string, startYear: number, startMonth: number, endYear: number, endMonth: number, member?: string | null) => {
        const familyId = await resolveFamilyId(userId);
        await assertOptionalFamilyMember(familyId, member, "member");
        const months = enumerateMonths(startYear, startMonth, endYear, endMonth);

        if (months.length === 0)
            throw new ValidationError("End month must not be before start month");
        if (months.length > MAX_TREND_MONTHS)
            throw new ValidationError(`Range cannot exceed ${MAX_TREND_MONTHS} months`);

        const data = await Promise.all(
            months.map(async ({ year, month }) => {
                const { breakdown } = await computeMonthBreakdown(familyId, year, month, member);
                return { year, month, breakdown };
            })
        );

        return { data };
    },
};

export default SavingsGoalService;
