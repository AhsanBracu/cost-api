import { z } from "zod";
import { Types } from "mongoose";
import SavingsGoal from "../models/SavingsGoalModel";
import Income from "../models/IncomeModel";
import Cost from "../models/CostModel";
import { NotFoundError, ValidationError } from "../errors/AppError";
import { createSavingsGoalSchema, updateSavingsGoalSchema, listSavingsGoalsQuerySchema } from "../schemas/savingsGoal.schema";

type CreateSavingsGoalInput = z.infer<typeof createSavingsGoalSchema>;
type UpdateSavingsGoalInput = z.infer<typeof updateSavingsGoalSchema>;
type ListSavingsGoalsQuery = z.infer<typeof listSavingsGoalsQuerySchema>;

const MAX_TREND_MONTHS = 36;

const computeMonthBreakdown = async (userId: string, year: number, month: number) => {
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const [incomeDoc, goals, costTotals] = await Promise.all([
        Income.findOne({ user: userId, year, month }),
        SavingsGoal.find({ user: userId, year, month }),
        Cost.aggregate([
            { $match: { user: new Types.ObjectId(userId), isDeleted: false, date: { $gte: monthStart, $lte: monthEnd } } },
            { $group: { _id: "$currency", total: { $sum: "$amount" } } },
            { $project: { _id: 0, currency: "$_id", total: 1 } },
        ]),
    ]);

    const goalTotalsByCurrency: Record<string, number> = {};
    for (const goal of goals)
        goalTotalsByCurrency[goal.currency] = (goalTotalsByCurrency[goal.currency] ?? 0) + goal.targetAmount;

    const currencies = new Set([
        ...(incomeDoc ? [incomeDoc.currency] : []),
        ...costTotals.map((c: { currency: string }) => c.currency),
        ...Object.keys(goalTotalsByCurrency),
    ]);

    const breakdown = Array.from(currencies).sort().map((currency) => {
        const income = incomeDoc && incomeDoc.currency === currency ? incomeDoc.amount : 0;
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
        return SavingsGoal.create({ ...data, user: userId });
    },

    listGoals: async (userId: string, query: ListSavingsGoalsQuery) => {
        const filter: Record<string, unknown> = { user: userId };
        if (query.year !== undefined)
            filter.year = query.year;
        if (query.month !== undefined)
            filter.month = query.month;

        return SavingsGoal.find(filter).sort({ year: -1, month: -1 });
    },

    getGoal: async (userId: string, goalId: string) => {
        const goal = await SavingsGoal.findOne({ _id: goalId, user: userId });
        if (!goal)
            throw new NotFoundError("Savings goal not found");

        return goal;
    },

    updateGoal: async (userId: string, goalId: string, data: UpdateSavingsGoalInput) => {
        const goal = await SavingsGoal.findOne({ _id: goalId, user: userId });
        if (!goal)
            throw new NotFoundError("Savings goal not found");

        Object.assign(goal, data);
        await goal.save();
        return goal;
    },

    deleteGoal: async (userId: string, goalId: string) => {
        const goal = await SavingsGoal.findOneAndDelete({ _id: goalId, user: userId });
        if (!goal)
            throw new NotFoundError("Savings goal not found");
    },

    getSummary: async (userId: string, year: number, month: number) => {
        const { goals, breakdown } = await computeMonthBreakdown(userId, year, month);
        return { year, month, goals, breakdown };
    },

    getTrend: async (userId: string, startYear: number, startMonth: number, endYear: number, endMonth: number) => {
        const months = enumerateMonths(startYear, startMonth, endYear, endMonth);

        if (months.length === 0)
            throw new ValidationError("End month must not be before start month");
        if (months.length > MAX_TREND_MONTHS)
            throw new ValidationError(`Range cannot exceed ${MAX_TREND_MONTHS} months`);

        const data = await Promise.all(
            months.map(async ({ year, month }) => {
                const { breakdown } = await computeMonthBreakdown(userId, year, month);
                return { year, month, breakdown };
            })
        );

        return { data };
    },
};

export default SavingsGoalService;
