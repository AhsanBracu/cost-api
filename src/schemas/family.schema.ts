import { z } from "zod";

export const createFamilySchema = z.object({
    name: z.string().min(1, "Family name is required").max(80, "Family name is too long"),
});

export const updateFamilySchema = z.object({
    name: z.string().min(1, "Family name is required").max(80, "Family name is too long"),
});

export const inviteMemberSchema = z.object({
    email: z.email("Invalid email address"),
});

export const acceptInviteSchema = z.object({
    token: z.string().min(1, "Token is required"),
});

export const activityLogQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});
