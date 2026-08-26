import mongoose, { Schema } from "mongoose";
import { IcategoryBudget, ImonthlySpendLimit } from "./types/IBudget";

const CategoryBudgetSchema: Schema<IcategoryBudget> = new Schema({
    family: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "User", default: null },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "SEK" },
}, { timestamps: true });

CategoryBudgetSchema.index({ family: 1, member: 1, year: 1, month: 1, category: 1 }, { unique: true });

const MonthlySpendLimitSchema: Schema<ImonthlySpendLimit> = new Schema({
    family: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "User", default: null },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "SEK" },
}, { timestamps: true });

MonthlySpendLimitSchema.index({ family: 1, member: 1, year: 1, month: 1 }, { unique: true });

export const CategoryBudget = mongoose.model<IcategoryBudget>("CategoryBudget", CategoryBudgetSchema);
export const MonthlySpendLimit = mongoose.model<ImonthlySpendLimit>("MonthlySpendLimit", MonthlySpendLimitSchema);
