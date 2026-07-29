import { z } from "zod";
import { passwordSchema } from "./common.schema";

export const changePasswordSchema = z.object({
    oldPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
});
