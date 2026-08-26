import mongoose, { Schema } from "mongoose";
import { IactivityLog } from "./types/IActivityLog";

const ActivityLogSchema: Schema<IactivityLog> = new Schema({
    family: { type: Schema.Types.ObjectId, ref: "Family", required: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: ["created", "updated", "deleted", "restored"], required: true },
    entity: {
        type: String,
        enum: ["cost", "income", "budget", "monthlyLimit", "savingsGoal", "category", "family", "familyMember", "familyInvite"],
        required: true,
    },
    entityId: { type: Schema.Types.ObjectId },
    summary: { type: String, required: true },
}, { timestamps: true });

// The log is almost always read as "what happened in this family, newest first".
ActivityLogSchema.index({ family: 1, createdAt: -1 });

const ActivityLog = mongoose.model<IactivityLog>("ActivityLog", ActivityLogSchema);

export default ActivityLog;
