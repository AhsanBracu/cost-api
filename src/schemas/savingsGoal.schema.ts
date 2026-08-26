import { z } from "zod";

// An HTML <select> can't submit a real null, so "" and "household" are both
// accepted as "a household goal" rather than one person's.
const memberField = z
    .preprocess((v) => (v === "" || v === "household" ? null : v), z.string().nullable())
    .optional();

export const createSavingsGoalSchema = z.object({
    member: memberField,
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
    member: memberField,
});

export const savingsSummaryQuerySchema = z.object({
    year: z.coerce.number().int(),
    month: z.coerce.number().int().min(1).max(12),
    member: memberField,
});

export const savingsTrendQuerySchema = z.object({
    startYear: z.coerce.number().int().min(2000).max(2100),
    startMonth: z.coerce.number().int().min(1).max(12),
    endYear: z.coerce.number().int().min(2000).max(2100),
    endMonth: z.coerce.number().int().min(1).max(12),
    member: memberField,
});
