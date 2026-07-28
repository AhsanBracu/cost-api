import mongoose, {Schema} from "mongoose";
import { Iuser } from "./types/IUser";
import bcrypt from 'bcrypt'


const UserSchema: Schema<Iuser>  = new Schema({

name: {type:String,required:true},
email :{type:String,required:true},
password :{type:String,required:true},
isVerified: {type:Boolean,required:true,default:false},
})

const saltRounds = 8

UserSchema.pre('save', async function (next) {
 const user = this;
 if (user.isModified('password')) {
   user.password = await bcrypt.hash(user.password, saltRounds);
 }
 next();
});


const User = mongoose.model<Iuser>('User', UserSchema);

export default User;