import { z } from "zod";

export const createSavingsGoalSchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    targetAmount: z.coerce.number().positive("Target amount must be greater than 0"),
    currency: z.string().length(3, "Currency must be a 3-letter ISO code").default("SEK"),
    purpose: z.string().min(1, "Purpose is required"),
});

export const updateSavingsGoalSchema = createSavingsGoalSchema.partial();

export const listSavingsGoalsQuerySchema = z.object({
    year: z.coerce.number().int().optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
});

export const savingsSummaryQuerySchema = z.object({
    year: z.coerce.number().int(),
    month: z.coerce.number().int().min(1).max(12),
});

export const savingsTrendQuerySchema = z.object({
    startYear: z.coerce.number().int().min(2000).max(2100),
    startMonth: z.coerce.number().int().min(1).max(12),
    endYear: z.coerce.number().int().min(2000).max(2100),
    endMonth: z.coerce.number().int().min(1).max(12),
});
