import { Document, Types } from "mongoose";

export interface Icategory extends Document {
    user: Types.ObjectId;
    name: string;
    color: string;
    createdAt: Date;
    updatedAt: Date;
}
