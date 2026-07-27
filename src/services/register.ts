import { Document } from "mongoose"
import { Iuser } from "../models/types/IUser";
import User from "../models/UserModel";
import bcrypt from 'bcrypt';
import donenv from 'dotenv'
import jwt from "jsonwebtoken";
import { UnauthorizedError, ConflictError } from "../errors/AppError";

donenv.config();

type userInput = Omit<Iuser & Document, '_id' | '__v'>;

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
       throw new Error("Secret key error");

    return jwt.sign({ _id: findUser._id as string, name: findUser.name }, secretKey, {
        expiresIn: "2 days",
    });


}

 const AuthService = {
    register : async (user: userInput) => {
        const existing = await User.findOne({ email: user.email });
        if (existing)
            throw new ConflictError("Email already registered");

        return User.create(user);
    },

    login : async (user: userInput)  : Promise <userReturn> => {

        const findUser = await User.findOne({ email: user.email })
        if (!findUser)
            throw new UnauthorizedError("Invalid email or password");

        const isMatch = await passwordCheck(user.password, findUser.password);
        if (!isMatch)
            throw new UnauthorizedError("Invalid email or password");

        const token = await createToken(findUser);
        return { user:findUser, token: token };
    }
}

export default AuthService;