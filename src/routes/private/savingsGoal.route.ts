import express, { Request, Response } from "express";
import { auth, CustomRequest } from "../../middleware/auth";
import { catchAsync } from "../../utils/catchAsync";
import { validate } from "../../middleware/validate";
import { createSavingsGoalSchema, updateSavingsGoalSchema, listSavingsGoalsQuerySchema, savingsSummaryQuerySchema, savingsTrendQuerySchema } from "../../schemas/savingsGoal.schema";
import SavingsGoalService from "../../services/savingsGoal";

const router = express.Router();

router.use(auth);

const getUserId = (req: Request) => ((req as CustomRequest).token as { _id: string })._id;

router.post('/', validate(createSavingsGoalSchema), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const goal = await SavingsGoalService.createGoal(userId, req.body);
    res.status(201).send({ goal });
}));

router.get('/', validate(listSavingsGoalsQuerySchema, 'query'), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const goals = await SavingsGoalService.listGoals(userId, req.query as any);
    res.send({ goals });
}));

router.get('/summary', validate(savingsSummaryQuerySchema, 'query'), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { year, month } = req.query as any;
    const summary = await SavingsGoalService.getSummary(userId, year, month);
    res.send(summary);
}));

router.get('/trend', validate(savingsTrendQuerySchema, 'query'), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { startYear, startMonth, endYear, endMonth } = req.query as any;
    const trend = await SavingsGoalService.getTrend(userId, startYear, startMonth, endYear, endMonth);
    res.send(trend);
}));

router.get('/:id', catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const goal = await SavingsGoalService.getGoal(userId, req.params.id);
    res.send({ goal });
}));

router.patch('/:id', validate(updateSavingsGoalSchema), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const goal = await SavingsGoalService.updateGoal(userId, req.params.id, req.body);
    res.send({ goal });
}));

router.delete('/:id', catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    await SavingsGoalService.deleteGoal(userId, req.params.id);
    res.send({ message: "Savings goal deleted" });
}));

export default router;
