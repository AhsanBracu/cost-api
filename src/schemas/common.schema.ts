import { z } from "zod";

export const passwordSchema = z.string()
    .min(7, "Password must be at least 7 characters")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[A-Z]/, "Password must contain at least one capital letter");
