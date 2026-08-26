import { z } from "zod";

export const createCategorySchema = z.object({
    name: z.string().min(1, "Name is required").max(50, "Name is too long"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex code like #2a78d6"),
});

export const updateCategorySchema = createCategorySchema.partial();
