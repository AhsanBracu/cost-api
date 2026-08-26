import { resolveFamilyId } from "./familyContext";
import { z } from "zod";
import Category from "../models/CategoryModel";
import { NotFoundError, ConflictError } from "../errors/AppError";
import { createCategorySchema, updateCategorySchema } from "../schemas/category.schema";

type CreateCategoryInput = z.infer<typeof createCategorySchema>;
type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// Seeded once per user on first access to /categories, so nothing already
// tagged with these names (existing Cost entries) becomes orphaned once
// categories move from a fixed enum to a user-managed list. The last four
// are the new ones requested when this feature was designed.
const DEFAULT_CATEGORIES = [
    { name: "Food", color: "#6ea8ff" },
    { name: "Transport", color: "#ff8a4c" },
    { name: "Housing", color: "#00d68f" },
    { name: "Utilities", color: "#ffc857" },
    { name: "Entertainment", color: "#ff85c0" },
    { name: "Health", color: "#37cdd6" },
    { name: "Shopping", color: "#a78bfa" },
    { name: "Other", color: "#ff6b6b" },
    { name: "Medicine", color: "#4ade80" },
    { name: "School", color: "#c084fc" },
    { name: "Recreation", color: "#fbbf24" },
    { name: "Tour", color: "#f472b6" },
];

const CategoryService = {
    listCategories: async (userId: string) => {
        const familyId = await resolveFamilyId(userId);
        const existing = await Category.find({ family: familyId }).sort({ name: 1 });
        if (existing.length > 0)
            return existing;

        await Category.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c, family: familyId })));
        return Category.find({ family: familyId }).sort({ name: 1 });
    },

    createCategory: async (userId: string, data: CreateCategoryInput) => {
        const familyId = await resolveFamilyId(userId);
        const existing = await Category.findOne({ family: familyId, name: data.name });
        if (existing)
            throw new ConflictError("A category with this name already exists");

        return Category.create({ ...data, family: familyId });
    },

    updateCategory: async (userId: string, categoryId: string, data: UpdateCategoryInput) => {
        const familyId = await resolveFamilyId(userId);
        const category = await Category.findOne({ _id: categoryId, family: familyId });
        if (!category)
            throw new NotFoundError("Category not found");

        if (data.name && data.name !== category.name) {
            const existing = await Category.findOne({ family: familyId, name: data.name });
            if (existing)
                throw new ConflictError("A category with this name already exists");
        }

        Object.assign(category, data);
        await category.save();
        return category;
    },

    deleteCategory: async (userId: string, categoryId: string) => {
        const familyId = await resolveFamilyId(userId);
        const category = await Category.findOneAndDelete({ _id: categoryId, family: familyId });
        if (!category)
            throw new NotFoundError("Category not found");
    },
};

export default CategoryService;
