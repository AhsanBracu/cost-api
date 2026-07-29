import express, { Request, Response } from "express";
import { auth, CustomRequest } from "../../middleware/auth";
import { catchAsync } from "../../utils/catchAsync";
import { validate } from "../../middleware/validate";
import { uploadReceipt } from "../../middleware/upload";
import { createCostSchema, updateCostSchema, listCostsQuerySchema } from "../../schemas/cost.schema";
import CostService from "../../services/cost";

const router = express.Router();

router.use(auth);

const getUserId = (req: Request) => ((req as CustomRequest).token as { _id: string })._id;

router.post('/', uploadReceipt, validate(createCostSchema), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : undefined;
    const cost = await CostService.createCost(userId, req.body, receiptUrl);
    res.status(201).send({ cost });
}));

router.get('/', validate(listCostsQuerySchema, 'query'), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const result = await CostService.listCosts(userId, req.query as any);
    res.send(result);
}));

router.get('/:id', catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const cost = await CostService.getCost(userId, req.params.id);
    res.send({ cost });
}));

router.patch('/:id', uploadReceipt, validate(updateCostSchema), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const receiptUrl = req.file ? `/uploads/receipts/${req.file.filename}` : undefined;
    const cost = await CostService.updateCost(userId, req.params.id, req.body, receiptUrl);
    res.send({ cost });
}));

router.delete('/:id', catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    await CostService.deleteCost(userId, req.params.id);
    res.send({ message: "Cost deleted" });
}));

router.post('/:id/restore', catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    await CostService.restoreCost(userId, req.params.id);
    res.send({ message: "Cost restored" });
}));

export default router;
