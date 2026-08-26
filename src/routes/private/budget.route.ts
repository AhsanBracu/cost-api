import express, { Request, Response } from "express";
import { auth, CustomRequest } from "../../middleware/auth";
import { catchAsync } from "../../utils/catchAsync";
import { validate } from "../../middleware/validate";
import { monthQuerySchema, setCategoryBudgetSchema, setMonthlyLimitSchema } from "../../schemas/budget.schema";
import BudgetService from "../../services/budget";

const router = express.Router();

router.use(auth);

const getUserId = (req: Request) => ((req as CustomRequest).token as { _id: string })._id;

router.get('/', validate(monthQuerySchema, 'query'), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { year, month } = req.query as any;
    const result = await BudgetService.getBudgets(userId, year, month);
    res.send(result);
}));

router.get('/summary', validate(monthQuerySchema, 'query'), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { year, month } = req.query as any;
    const summary = await BudgetService.getBudgetSummary(userId, year, month);
    res.send(summary);
}));

router.put('/category', validate(setCategoryBudgetSchema), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const budget = await BudgetService.setCategoryBudget(userId, req.body);
    res.send({ budget });
}));

router.delete('/category/:id', catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    await BudgetService.deleteCategoryBudget(userId, req.params.id);
    res.send({ message: "Budget deleted" });
}));

router.put('/limit', validate(setMonthlyLimitSchema), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const monthlyLimit = await BudgetService.setMonthlyLimit(userId, req.body);
    res.send({ monthlyLimit });
}));

router.delete('/limit', validate(monthQuerySchema, 'query'), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { year, month } = req.query as any;
    await BudgetService.deleteMonthlyLimit(userId, year, month);
    res.send({ message: "Monthly limit removed" });
}));

export default router;
