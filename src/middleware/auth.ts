import { NextFunction, Request, Response } from "express";
import dotenv from 'dotenv';
import jwt from "jsonwebtoken";

dotenv.config()

export interface CustomRequest extends Request {
    token: string | jwt.JwtPayload;
  }

export const auth = async (req: Request, res: Response, next: NextFunction) => {

    try {
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token)
            throw new Error("Authentication Error");

        const secretKey = process.env.SECRET_KEY;
        if (!secretKey)
            throw new Error("Secret key Error");

        const decoded = jwt.verify(token, secretKey);
        (req as CustomRequest).token = decoded;
        next();

    } catch (error) {
        res.status(401).json({ error: error instanceof Error ? error.message : "Authentication Error" });
    }


}