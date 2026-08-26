import { z } from "zod";

// Present on every report so any view can be narrowed to one person.
// forWhom accepts "shared" for household costs, which are stored as null.
const attributionFields = {
    paidBy: z.string().optional(),
    forWhom: z.string().optional(),
};

export const summaryQuerySchema = z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    ...attributionFields,
});

export const trendQuerySchema = z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    interval: z.enum(["day", "week", "month"]).default("month"),
    ...attributionFields,
});

export const compareQuerySchema = z.object({
    granularity: z.enum(["day", "week", "month"]).default("month"),
    days: z.coerce.number().int().min(1).max(90).default(10),
    referenceDate: z.coerce.date().optional(),
    ...attributionFields,
});
