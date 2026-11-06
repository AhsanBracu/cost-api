import { Document, Types } from "mongoose";

/** The qualitative half of an insight -- the only part a model produces. */
export interface InsightNarrative {
    mainDriver: string;
    explanation: string;
    suggestions: string[];
}

/**
 * Identifies the costs an insight was built from.
 *
 * A stored explanation is only valid for the data it saw. Rather than guess at
 * a time-based expiry, record what the day looked like: if a cost is added,
 * edited or deleted afterwards, one of these changes and the row is stale.
 * `lastModified` catches edits that leave the count and total untouched.
 */
export interface InsightFingerprint {
    costCount: number;
    lastModified?: Date;
}

export interface IdailyInsight extends Document {
    family: Types.ObjectId;
    /** Midnight of the day being explained, so one row per family per day. */
    date: Date;
    narrative: InsightNarrative;
    /** Which tools the model chose, kept so you can see how it got there. */
    toolCalls: { name: string; input: any }[];
    fingerprint: InsightFingerprint;
    createdAt: Date;
    updatedAt: Date;
}
