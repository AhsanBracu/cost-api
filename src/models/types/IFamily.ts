import { Document, Types } from "mongoose";

export interface Ifamily extends Document {
    name: string;
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export type InviteStatus = "pending" | "accepted" | "revoked";

export interface IfamilyInvite extends Document {
    family: Types.ObjectId;
    email: string;
    invitedBy: Types.ObjectId;
    token: string;
    status: InviteStatus;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
