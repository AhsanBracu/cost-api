import { Document, Types } from "mongoose";

/** A spending budget for one category in one month. */
export interface IcategoryBudget extends Document {
    family: Types.ObjectId;
    /** Whose budget; null means the household-wide one. */
    member: Types.ObjectId | null;
    year: number;
    month: number;
    category: string;
    amount: number;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * An overall cap for the month, independent of the per-category budgets.
 * Kept separate rather than derived from the category budgets so you can
 * cap the month without having to budget every category.
 */
export interface ImonthlySpendLimit extends Document {
    family: Types.ObjectId;
    /** Whose limit; null means the household-wide one. */
    member: Types.ObjectId | null;
    year: number;
    month: number;
    amount: number;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
}
