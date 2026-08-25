import mongoose, { Schema } from "mongoose";
import { IsavingsGoal } from "./types/ISavingsGoal";

const SavingsGoalSchema: Schema<IsavingsGoal> = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    targetAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "USD" },
    purpose: { type: String, required: true },
}, { timestamps: true });

const SavingsGoal = mongoose.model<IsavingsGoal>("SavingsGoal", SavingsGoalSchema);

export default SavingsGoal;
