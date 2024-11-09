import { Document, Model } from "mongoose"
import UserModel from "../models/UserModel"
import { Iuser } from "../models/types/IUser";
import User from "../models/UserModel";
import bcrypt from 'bcrypt';
import donenv from 'dotenv'
import jwt from "jsonwebtoken";

donenv.config();

type userInput = Omit<Iuser & Document, '_id' | 'v'>;

type userReturn ={ 
    user: Iuser & Document;
    token : string
}

const passwordCheck = async (inputPassword:string, storedPassword:string):Promise<boolean> =>{

    return bcrypt.compare(inputPassword,storedPassword)
}

const createToken = async (findUser: Iuser & Document):Promise<string>=>{
    const secretKey = process.env.SECRET_KEY;
    if(!secretKey)
       throw new Error("Scret key Error");

    return jwt.sign({ _id: findUser._id as string, name: findUser.name }, secretKey, {
        expiresIn: "2 days",
    });


}

 const AuthService = {
    register : async (user: userInput) => {
        try {
            await User.create(user);
        } catch (error) {
            throw error;
        }
    },

    login : async (user: userInput)  : Promise <userReturn> => {

        const findUser = await User.findOne({ email: user.email }) 
        if (!findUser)
            throw new Error("Wrong email user");
        else {

            const isMatch = await passwordCheck(user.password, findUser.password);
            if (isMatch){
               const token =await createToken(findUser);
                  return { user:findUser, token: token };
            }
            else
                throw new Error("Wrong Password");
        }
    }   
}

export default AuthService;