import express, { Request, Response } from "express";
import { auth, CustomRequest } from "../../middleware/auth";
import { catchAsync } from "../../utils/catchAsync";
import { validate } from "../../middleware/validate";
import { dailyInsightQuerySchema } from "../../schemas/insight.schema";
import InsightService from "../../services/insight";
import { isLlmConfigured } from "../../services/llm";

const router = express.Router();

router.use(auth);

const getUserId = (req: Request) => ((req as CustomRequest).token as { _id: string })._id;

// The numbers only -- no model involved, so this one always works.
router.get('/daily', validate(dailyInsightQuerySchema, 'query'), catchAsync(async (req: Request, res: Response) => {
    const { date } = req.query as { date?: Date };
    const result = await InsightService.getDailyComparison(getUserId(req), date);
    res.send(result);
}));

// The numbers plus an explanation of them. `narrative` is null when no API key
// is configured, which the frontend should treat as "show the figures only".
// Read-only: returns the stored explanation for the day, or narrative: null if
// there isn't one yet. Never calls the model, so it's safe on every page load.
router.get('/daily/explained', validate(dailyInsightQuerySchema, 'query'), catchAsync(async (req: Request, res: Response) => {
    const { date } = req.query as { date?: Date };
    const result = await InsightService.getDailyInsight(getUserId(req), date);
    res.send({ ...result, llmConfigured: isLlmConfigured() });
}));

// Generates one. POST rather than GET because it spends money and writes a row
// -- this is the button, used both for the first explanation of a day and for
// refreshing one the costs have moved past.
router.post('/daily/explained', validate(dailyInsightQuerySchema, 'query'), catchAsync(async (req: Request, res: Response) => {
    const { date } = req.query as { date?: Date };
    const result = await InsightService.getDailyInsight(getUserId(req), date, { generate: true });
    res.send({ ...result, llmConfigured: isLlmConfigured() });
}));

export default router;
