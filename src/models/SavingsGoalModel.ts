import mongoose, { Schema } from "mongoose";
import { IsavingsGoal } from "./types/ISavingsGoal";

const SavingsGoalSchema: Schema<IsavingsGoal> = new Schema({
    family: { type: Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    member: { type: Schema.Types.ObjectId, ref: "User", default: null },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    targetAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "SEK" },
    purpose: { type: String, required: true },
}, { timestamps: true });

const SavingsGoal = mongoose.model<IsavingsGoal>("SavingsGoal", SavingsGoalSchema);

export default SavingsGoal;
