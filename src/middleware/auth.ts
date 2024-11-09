import { NextFunction } from "express";
import dotenv from 'dotenv';
import donenv from 'dotenv'
import jwt from "jsonwebtoken";

dotenv.config()

export interface CustomRequest extends Request {
    token: string | jwt.JwtPayload;
  }

export const auth = async (req: Request, res: Response, next: NextFunction) => {

    try {
        const token = req.headers.get("authorization")?.replace("Bearer ", "");
        if (!token)
            throw new Error("Authentication Error");
        else {
            if (process.env.SECRET_KEY) {
             const decoded = jwt.verify(token, process.env.SECRET_KEY);

             (req as CustomRequest).token = decoded;
             next();
            }
        }

    } catch (error) {
        throw error;
    }


}