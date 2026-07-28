import { Document } from "mongoose"
import { Iuser } from "../models/types/IUser";
import User from "../models/UserModel";
import bcrypt from 'bcrypt';
import donenv from 'dotenv'
import jwt from "jsonwebtoken";
import { UnauthorizedError, ConflictError, ForbiddenError, NotFoundError } from "../errors/AppError";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";

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

const createPurposeToken = (userId: string, purpose: string, expiresIn: string): string => {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey)
        throw new Error("Secret key error");

    return jwt.sign({ _id: userId, purpose }, secretKey, { expiresIn });
}

const verifyPurposeToken = (token: string, purpose: string): jwt.JwtPayload => {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey)
        throw new Error("Secret key error");

    let payload: jwt.JwtPayload;
    try {
        payload = jwt.verify(token, secretKey) as jwt.JwtPayload;
    } catch {
        throw new UnauthorizedError("Invalid or expired token");
    }

    if (payload.purpose !== purpose)
        throw new UnauthorizedError("Invalid token");

    return payload;
}

 const AuthService = {
    register : async (user: userInput) => {
        const existing = await User.findOne({ email: user.email });
        if (existing)
            throw new ConflictError("Email already registered");

        const newUser = await User.create(user);
        const verificationToken = createPurposeToken(newUser._id as string, "email-verification", "1d");
        await sendVerificationEmail(newUser.email, verificationToken);

        return newUser;
    },

    verifyEmail : async (token: string) => {
        const payload = verifyPurposeToken(token, "email-verification");

        const user = await User.findById(payload._id);
        if (!user)
            throw new NotFoundError("User not found");

        user.isVerified = true;
        await user.save();
    },

    forgotPassword : async (email: string) => {
        const user = await User.findOne({ email });
        if (!user)
            return;

        const resetToken = createPurposeToken(user._id as string, "password-reset", "15m");
        await sendPasswordResetEmail(user.email, resetToken);
    },

    resetPassword : async (token: string, newPassword: string) => {
        const payload = verifyPurposeToken(token, "password-reset");

        const user = await User.findById(payload._id);
        if (!user)
            throw new NotFoundError("User not found");

        user.password = newPassword;
        await user.save();
    },

    login : async (user: userInput)  : Promise <userReturn> => {

        const findUser = await User.findOne({ email: user.email })
        if (!findUser)
            throw new UnauthorizedError("Invalid email or password");

        const isMatch = await passwordCheck(user.password, findUser.password);
        if (!isMatch)
            throw new UnauthorizedError("Invalid email or password");

        if (!findUser.isVerified)
            throw new ForbiddenError("Please verify your email before logging in");

        const token = await createToken(findUser);
        return { user:findUser, token: token };
    }
}

export default AuthService;