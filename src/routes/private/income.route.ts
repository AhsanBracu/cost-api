import express, { Request, Response } from "express";
import { auth, CustomRequest } from "../../middleware/auth";
import { catchAsync } from "../../utils/catchAsync";
import { validate } from "../../middleware/validate";
import { createIncomeSchema, updateIncomeSchema, listIncomeQuerySchema } from "../../schemas/income.schema";
import IncomeService from "../../services/income";

const router = express.Router();

router.use(auth);

const getUserId = (req: Request) => ((req as CustomRequest).token as { _id: string })._id;

router.post('/', validate(createIncomeSchema), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const income = await IncomeService.createIncome(userId, req.body);
    res.status(201).send({ income });
}));

router.get('/', validate(listIncomeQuerySchema, 'query'), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const incomes = await IncomeService.listIncome(userId, req.query as any);
    res.send({ incomes });
}));

router.get('/:id', catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const income = await IncomeService.getIncome(userId, req.params.id);
    res.send({ income });
}));

router.patch('/:id', validate(updateIncomeSchema), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const income = await IncomeService.updateIncome(userId, req.params.id, req.body);
    res.send({ income });
}));

router.delete('/:id', catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    await IncomeService.deleteIncome(userId, req.params.id);
    res.send({ message: "Income deleted" });
}));

export default router;
