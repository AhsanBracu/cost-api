import express, { Request, Response } from "express";
import { auth, CustomRequest } from "../../middleware/auth";
import { catchAsync } from "../../utils/catchAsync";
import { validate } from "../../middleware/validate";
import { createCategorySchema, updateCategorySchema } from "../../schemas/category.schema";
import CategoryService from "../../services/category";

const router = express.Router();

router.use(auth);

const getUserId = (req: Request) => ((req as CustomRequest).token as { _id: string })._id;

router.get('/', catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const categories = await CategoryService.listCategories(userId);
    res.send({ categories });
}));

router.post('/', validate(createCategorySchema), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const category = await CategoryService.createCategory(userId, req.body);
    res.status(201).send({ category });
}));

router.patch('/:id', validate(updateCategorySchema), catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const category = await CategoryService.updateCategory(userId, req.params.id, req.body);
    res.send({ category });
}));

router.delete('/:id', catchAsync(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    await CategoryService.deleteCategory(userId, req.params.id);
    res.send({ message: "Category deleted" });
}));

export default router;
