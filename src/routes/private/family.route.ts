import express, { Request, Response } from "express";
import { auth, CustomRequest } from "../../middleware/auth";
import { catchAsync } from "../../utils/catchAsync";
import { validate } from "../../middleware/validate";
import {
    updateFamilySchema,
    inviteMemberSchema,
    acceptInviteSchema,
    activityLogQuerySchema,
} from "../../schemas/family.schema";
import FamilyService from "../../services/family";
import ActivityLogService from "../../services/activityLog";

const router = express.Router();

router.use(auth);

const getUserId = (req: Request) => ((req as CustomRequest).token as { _id: string })._id;

router.get('/me', catchAsync(async (req: Request, res: Response) => {
    const result = await FamilyService.getMyFamily(getUserId(req));
    res.send(result);
}));

router.patch('/me', validate(updateFamilySchema), catchAsync(async (req: Request, res: Response) => {
    const family = await FamilyService.updateFamily(getUserId(req), req.body.name);
    res.send({ family });
}));

router.post('/invites', validate(inviteMemberSchema), catchAsync(async (req: Request, res: Response) => {
    const invite = await FamilyService.inviteMember(getUserId(req), req.body.email);
    res.status(201).send({ invite });
}));

router.delete('/invites/:id', catchAsync(async (req: Request, res: Response) => {
    await FamilyService.revokeInvite(getUserId(req), req.params.id);
    res.send({ message: "Invite revoked" });
}));

router.post('/invites/accept', validate(acceptInviteSchema), catchAsync(async (req: Request, res: Response) => {
    const family = await FamilyService.acceptInvite(getUserId(req), req.body.token);
    res.send({ family });
}));

router.delete('/members/:id', catchAsync(async (req: Request, res: Response) => {
    await FamilyService.removeMember(getUserId(req), req.params.id);
    res.send({ message: "Member removed" });
}));

router.get('/activity', validate(activityLogQuerySchema, 'query'), catchAsync(async (req: Request, res: Response) => {
    const familyId = await FamilyService.ensureFamily(getUserId(req));
    const result = await ActivityLogService.list(familyId, req.query as any);
    res.send(result);
}));

export default router;
