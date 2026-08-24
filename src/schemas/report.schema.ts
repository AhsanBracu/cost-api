import { z } from "zod";

export const summaryQuerySchema = z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
});

export const trendQuerySchema = z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    interval: z.enum(["day", "week", "month"]).default("month"),
});

export const compareQuerySchema = z.object({
    granularity: z.enum(["day", "week", "month"]).default("month"),
    days: z.coerce.number().int().min(1).max(90).default(10),
    referenceDate: z.coerce.date().optional(),
});
