import { z } from "zod";

export const createIncomeSchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    currency: z.string().length(3, "Currency must be a 3-letter ISO code").default("SEK"),
});

export const updateIncomeSchema = createIncomeSchema.partial();

export const listIncomeQuerySchema = z.object({
    year: z.coerce.number().int().optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
});
