import { z } from "zod";

export const monthQuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
});

export const setCategoryBudgetSchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    category: z.string().min(1, "Category is required"),
    amount: z.coerce.number().min(0, "Amount cannot be negative"),
    currency: z.string().length(3, "Currency must be a 3-letter ISO code").default("SEK"),
});

export const setMonthlyLimitSchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    amount: z.coerce.number().min(0, "Amount cannot be negative"),
    currency: z.string().length(3, "Currency must be a 3-letter ISO code").default("SEK"),
});
