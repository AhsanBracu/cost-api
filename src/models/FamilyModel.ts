import mongoose, { Schema } from "mongoose";
import { Ifamily, IfamilyInvite } from "./types/IFamily";

const FamilySchema: Schema<Ifamily> = new Schema({
    name: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

const FamilyInviteSchema: Schema<IfamilyInvite> = new Schema({
    family: { type: Schema.Types.ObjectId, ref: "Family", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "accepted", "revoked"], required: true, default: "pending" },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

// One live invite per email per family; accepted/revoked ones are kept for
// the audit trail, so the uniqueness only applies while still pending.
FamilyInviteSchema.index(
    { family: 1, email: 1 },
    { unique: true, partialFilterExpression: { status: "pending" } }
);

export const Family = mongoose.model<Ifamily>("Family", FamilySchema);
export const FamilyInvite = mongoose.model<IfamilyInvite>("FamilyInvite", FamilyInviteSchema);
