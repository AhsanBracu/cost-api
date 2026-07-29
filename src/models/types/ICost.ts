import { Document, Types } from "mongoose";

export enum CostCategory {
    Food = "Food",
    Transport = "Transport",
    Housing = "Housing",
    Utilities = "Utilities",
    Entertainment = "Entertainment",
    Health = "Health",
    Shopping = "Shopping",
    Other = "Other",
}

export enum PaymentMethod {
    Cash = "Cash",
    Card = "Card",
    BankTransfer = "Bank Transfer",
    MobilePayment = "Mobile Payment",
    Other = "Other",
}

export interface Icost extends Document {
    user: Types.ObjectId;
    amount: number;
    currency: string;
    date: Date;
    place?: string;
    description?: string;
    category: CostCategory;
    paymentMethod: PaymentMethod;
    receiptUrl?: string;
    tags: string[];
    notes?: string;
    isDeleted: boolean;
    deletedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
