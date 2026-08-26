import mongoose, { Schema } from "mongoose";
import { Iincome } from "./types/IIncome";

const IncomeSchema: Schema<Iincome> = new Schema({
    family: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    earnedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "SEK" },
}, { timestamps: true });

// One income row per person per month -- two earners means two rows.
IncomeSchema.index({ family: 1, year: 1, month: 1, earnedBy: 1 }, { unique: true });

const Income = mongoose.model<Iincome>("Income", IncomeSchema);

export default Income;
