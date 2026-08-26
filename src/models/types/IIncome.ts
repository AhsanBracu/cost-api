import { Document, Types } from "mongoose";

export interface Iincome extends Document {
    family: Types.ObjectId;
    createdBy: Types.ObjectId;
    earnedBy: Types.ObjectId;
    year: number;
    month: number;
    amount: number;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
}
