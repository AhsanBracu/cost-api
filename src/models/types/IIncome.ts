import { Document, Types } from "mongoose";

export interface Iincome extends Document {
    user: Types.ObjectId;
    year: number;
    month: number;
    amount: number;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
}
