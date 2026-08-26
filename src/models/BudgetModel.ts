import mongoose, { Schema } from "mongoose";
import { IcategoryBudget, ImonthlySpendLimit } from "./types/IBudget";

const CategoryBudgetSchema: Schema<IcategoryBudget> = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "SEK" },
}, { timestamps: true });

CategoryBudgetSchema.index({ user: 1, year: 1, month: 1, category: 1 }, { unique: true });

const MonthlySpendLimitSchema: Schema<ImonthlySpendLimit> = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "SEK" },
}, { timestamps: true });

MonthlySpendLimitSchema.index({ user: 1, year: 1, month: 1 }, { unique: true });

export const CategoryBudget = mongoose.model<IcategoryBudget>("CategoryBudget", CategoryBudgetSchema);
export const MonthlySpendLimit = mongoose.model<ImonthlySpendLimit>("MonthlySpendLimit", MonthlySpendLimitSchema);
