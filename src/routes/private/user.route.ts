import express, { Request, Response } from "express";
import { auth, CustomRequest } from "../../middleware/auth";
import { catchAsync } from "../../utils/catchAsync";
import { validate } from "../../middleware/validate";
import { changePasswordSchema } from "../../schemas/user.schema";
import UserService from "../../services/user";

const router = express.Router();

router.use(auth);

router.get('/profile', catchAsync(async (req: Request, res: Response) => {
    const { _id } = (req as CustomRequest).token as { _id: string };
    const user = await UserService.getProfile(_id);
    res.send({ user });
}));

router.patch('/change-password', validate(changePasswordSchema), catchAsync(async (req: Request, res: Response) => {
    const { _id } = (req as CustomRequest).token as { _id: string };
    const { oldPassword, newPassword } = req.body;
    await UserService.changePassword(_id, oldPassword, newPassword);
    res.send({ message: "Password updated successfully" });
}));

router.post('/logout', (req: Request, res: Response) => {
    res.send({ message: "Logged out successfully" });
});

export default router;
