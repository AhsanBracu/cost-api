import mongoose, { Schema } from "mongoose";
import { Icost, CostCategory, PaymentMethod } from "./types/ICost";

const CostSchema: Schema<Icost> = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "USD" },
    date: { type: Date, required: true },
    place: { type: String },
    description: { type: String },
    category: { type: String, enum: Object.values(CostCategory), required: true },
    paymentMethod: { type: String, enum: Object.values(PaymentMethod), required: true },
    receiptUrl: { type: String },
    tags: { type: [String], default: [] },
    notes: { type: String },
    isDeleted: { type: Boolean, required: true, default: false },
    deletedAt: { type: Date },
}, { timestamps: true });

const Cost = mongoose.model<Icost>("Cost", CostSchema);

export default Cost;
