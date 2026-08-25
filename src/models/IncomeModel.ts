import mongoose, { Schema } from "mongoose";
import { Iincome } from "./types/IIncome";

const IncomeSchema: Schema<Iincome> = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "USD" },
}, { timestamps: true });

IncomeSchema.index({ user: 1, year: 1, month: 1 }, { unique: true });

const Income = mongoose.model<Iincome>("Income", IncomeSchema);

export default Income;
