import { z } from "zod";
import { PaymentMethod } from "../models/types/ICost";

// multer/multipart form submissions deliver a repeated "tags" field as a
// single string (the last value), not an array, unlike JSON bodies.
const tagsField = z.preprocess((val) => {
    if (typeof val === "string")
        return val.split(",").map((tag) => tag.trim()).filter(Boolean);
    return val;
}, z.array(z.string())).optional();

export const createCostSchema = z.object({
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    currency: z.string().length(3, "Currency must be a 3-letter ISO code").default("SEK"),
    date: z.coerce.date(),
    place: z.string().optional(),
    description: z.string().optional(),
    category: z.string().min(1, "Category is required"),
    paymentMethod: z.enum(PaymentMethod),
    tags: tagsField,
    notes: z.string().optional(),
    // Defaults to the current user when omitted.
    paidBy: z.string().optional(),
    // "" and "shared" both mean a shared household cost, since an HTML
    // select cannot submit a real null.
    forWhom: z.preprocess((v) => (v === "" || v === "shared" ? null : v), z.string().nullable()).optional(),
});

export const updateCostSchema = createCostSchema.partial();

export const listCostsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(["date", "amount", "createdAt"]).default("date"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    category: z.string().optional(),
    paymentMethod: z.enum(PaymentMethod).optional(),
    place: z.string().optional(),
    minAmount: z.coerce.number().optional(),
    maxAmount: z.coerce.number().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    search: z.string().optional(),
    paidBy: z.string().optional(),
    forWhom: z.string().optional(),
});
