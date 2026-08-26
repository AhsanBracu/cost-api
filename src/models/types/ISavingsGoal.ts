import { Document, Types } from "mongoose";

export interface IsavingsGoal extends Document {
    family: Types.ObjectId;
    createdBy: Types.ObjectId;
    /** Whose goal; null means a household goal. */
    member: Types.ObjectId | null;
    year: number;
    month: number;
    targetAmount: number;
    currency: string;
    purpose: string;
    createdAt: Date;
    updatedAt: Date;
}
