import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import { ValidationError } from "../errors/AppError";

export const validate = (schema: ZodType, source: "body" | "query" = "body") => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[source]);
        if (!result.success) {
            const message = result.error.issues.map(issue => issue.message).join(", ");
            throw new ValidationError(message);
        }

        if (source === "body") {
            req.body = result.data;
        } else {
            Object.assign(req.query, result.data);
        }

        next();
    };
};
