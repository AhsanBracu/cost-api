import { z } from "zod";

// An HTML <select> can't submit a real null, so "" and "household" are both
// accepted as "the household-wide row" rather than a specific member.
const memberField = z
    .preprocess((v) => (v === "" || v === "household" ? null : v), z.string().nullable())
    .optional();

export const monthQuerySchema = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    member: memberField,
});

export const setCategoryBudgetSchema = z.object({
    member: memberField,
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    category: z.string().min(1, "Category is required"),
    amount: z.coerce.number().min(0, "Amount cannot be negative"),
    currency: z.string().length(3, "Currency must be a 3-letter ISO code").default("SEK"),
});

export const setMonthlyLimitSchema = z.object({
    member: memberField,
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    amount: z.coerce.number().min(0, "Amount cannot be negative"),
    currency: z.string().length(3, "Currency must be a 3-letter ISO code").default("SEK"),
});
