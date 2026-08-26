import { Document, Types } from "mongoose";

export type ActivityAction = "created" | "updated" | "deleted" | "restored";

export type ActivityEntity =
    | "cost"
    | "income"
    | "budget"
    | "monthlyLimit"
    | "savingsGoal"
    | "category"
    | "family"
    | "familyMember"
    | "familyInvite";

export interface IactivityLog extends Document {
    family: Types.ObjectId;
    actor: Types.ObjectId;
    action: ActivityAction;
    entity: ActivityEntity;
    entityId?: Types.ObjectId;
    /** Human-readable one-liner, e.g. 'Food cost of 420 SEK at Willys'. */
    summary: string;
    createdAt: Date;
    updatedAt: Date;
}
