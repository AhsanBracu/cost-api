import  {NextFunction, Request,Response}  from "express";
import { BaseError } from "../errors/BaseError";

const errorHandler = (err: BaseError, req: Request, res: Response, next: NextFunction) =>{

    console.log(`[ERROR] ${err.name}: ${err.message}`);

    res.status(err.httpcode || 500).json({
        error: err.name,
        message: err.message || "Something went wrong!"
    })
};


export default errorHandler;