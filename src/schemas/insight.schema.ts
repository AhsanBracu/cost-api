import { z } from "zod";

export const dailyInsightQuerySchema = z.object({
    // Optional override, mainly so you can look at a past day while testing.
    date: z.coerce.date().optional(),
    // Query strings carry "true"/"false" as text, so coerce rather than
    // z.boolean() -- the string "false" is truthy to z.coerce.boolean().
    refresh: z
        .preprocess((v) => v === "true" || v === true, z.boolean())
        .optional(),
});
