import { Document, Types } from "mongoose";

export enum PaymentMethod {
    Cash = "Cash",
    Card = "Card",
    BankTransfer = "Bank Transfer",
    MobilePayment = "Mobile Payment",
    Other = "Other",
}

export interface Icost extends Document {
    family: Types.ObjectId;
    /** Who entered it -- for the audit trail, not for attribution. */
    createdBy: Types.ObjectId;
    /** Whose money went out. */
    paidBy: Types.ObjectId;
    /** Who it was for; null means a shared household cost. */
    forWhom: Types.ObjectId | null;
    amount: number;
    currency: string;
    date: Date;
    place?: string;
    description?: string;
    category: string;
    paymentMethod: PaymentMethod;
    receiptUrl?: string;
    tags: string[];
    notes?: string;
    isDeleted: boolean;
    deletedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
