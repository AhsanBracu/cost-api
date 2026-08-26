import { Document, Types } from "mongoose";

export interface Iuser extends Document{
name: string,
email:string,
password: string,
isVerified: boolean,
/** Every user belongs to exactly one family; created on demand if absent. */
family?: Types.ObjectId
}