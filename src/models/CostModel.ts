import mongoose, { Schema } from "mongoose";
import { Icost, PaymentMethod } from "./types/ICost";

const CostSchema: Schema<Icost> = new Schema({
    family: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // null is meaningful here: a shared household cost, not "unset".
    forWhom: { type: Schema.Types.ObjectId, ref: "User", default: null },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "SEK" },
    date: { type: Date, required: true },
    place: { type: String },
    description: { type: String },
    category: { type: String, required: true },
    paymentMethod: { type: String, enum: Object.values(PaymentMethod), required: true },
    receiptUrl: { type: String },
    tags: { type: [String], default: [] },
    notes: { type: String },
    isDeleted: { type: Boolean, required: true, default: false },
    deletedAt: { type: Date },
}, { timestamps: true });

const Cost = mongoose.model<Icost>("Cost", CostSchema);

export default Cost;
