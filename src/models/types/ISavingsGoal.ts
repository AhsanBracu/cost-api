import { Document, Types } from "mongoose";

export interface IsavingsGoal extends Document {
    user: Types.ObjectId;
    year: number;
    month: number;
    targetAmount: number;
    currency: string;
    purpose: string;
    createdAt: Date;
    updatedAt: Date;
}
