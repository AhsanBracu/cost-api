import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import { ValidationError } from "../errors/AppError";

export const validate = (schema: ZodType) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const message = result.error.issues.map(issue => issue.message).join(", ");
            throw new ValidationError(message);
        }

        req.body = result.data;
        next();
    };
};
