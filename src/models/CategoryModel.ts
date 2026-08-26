import mongoose, { Schema } from "mongoose";
import { Icategory } from "./types/ICategory";

const CategorySchema: Schema<Icategory> = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, required: true },
}, { timestamps: true });

CategorySchema.index({ user: 1, name: 1 }, { unique: true });

const Category = mongoose.model<Icategory>("Category", CategorySchema);

export default Category;
