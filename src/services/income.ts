import { z } from "zod";
import Income from "../models/IncomeModel";
import { NotFoundError, ConflictError } from "../errors/AppError";
import { createIncomeSchema, updateIncomeSchema, listIncomeQuerySchema } from "../schemas/income.schema";

type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;
type ListIncomeQuery = z.infer<typeof listIncomeQuerySchema>;

const IncomeService = {
    createIncome: async (userId: string, data: CreateIncomeInput) => {
        const existing = await Income.findOne({ user: userId, year: data.year, month: data.month });
        if (existing)
            throw new ConflictError("Income for this month already exists");

        return Income.create({ ...data, user: userId });
    },

    listIncome: async (userId: string, query: ListIncomeQuery) => {
        const filter: Record<string, unknown> = { user: userId };
        if (query.year !== undefined)
            filter.year = query.year;
        if (query.month !== undefined)
            filter.month = query.month;

        return Income.find(filter).sort({ year: -1, month: -1 });
    },

    getIncome: async (userId: string, incomeId: string) => {
        const income = await Income.findOne({ _id: incomeId, user: userId });
        if (!income)
            throw new NotFoundError("Income not found");

        return income;
    },

    updateIncome: async (userId: string, incomeId: string, data: UpdateIncomeInput) => {
        const income = await Income.findOne({ _id: incomeId, user: userId });
        if (!income)
            throw new NotFoundError("Income not found");

        Object.assign(income, data);
        await income.save();
        return income;
    },

    deleteIncome: async (userId: string, incomeId: string) => {
        const income = await Income.findOneAndDelete({ _id: incomeId, user: userId });
        if (!income)
            throw new NotFoundError("Income not found");
    },
};

export default IncomeService;
