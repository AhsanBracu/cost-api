import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../errors/AppError";

export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
    }

    if (err instanceof multer.MulterError) {
        res.status(400).json({ error: err.message });
        return;
    }

    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
};
