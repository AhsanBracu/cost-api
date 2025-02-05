import mongoose, {Schema,Model, mongo} from "mongoose";
import { Iuser } from "./types/IUser";
import bcrypt from 'bcrypt'


const UserSchema: Schema<Iuser>  = new Schema({

name: {type:String,require:true},
email :{type:String,require:true},
password :{type:String,require:true},
})

const saltRounds = 8

UserSchema.pre('save', async function (next) {
 const user = this;
 if (user.isModified('password')) {
   user.password = await bcrypt.hash(user.password, saltRounds);
 }
 next();
});


const User :Model<Iuser> = mongoose.model<Iuser>('User',UserSchema);

export default User;