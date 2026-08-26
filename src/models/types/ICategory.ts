import { Document, Types } from "mongoose";

export interface Icategory extends Document {
    family: Types.ObjectId;
    name: string;
    color: string;
    createdAt: Date;
    updatedAt: Date;
}
