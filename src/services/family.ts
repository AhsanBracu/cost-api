import crypto from "crypto";
import { Family, FamilyInvite } from "../models/FamilyModel";
import User from "../models/UserModel";
import { NotFoundError, ConflictError, ValidationError } from "../errors/AppError";
import { sendFamilyInviteEmail } from "./email";
import ActivityLogService from "./activityLog";

const INVITE_TTL_DAYS = 7;

/**
 * Every user acts within exactly one family. Rather than force a setup step,
 * a solo family is created on first use -- so a single user never notices the
 * concept until they invite someone.
 */
const ensureFamily = async (userId: string) => {
    const user = await User.findById(userId);
    if (!user)
        throw new NotFoundError("User not found");

    if (user.family)
        return user.family.toString();

    const family = await Family.create({ name: `${user.name}'s family`, createdBy: user._id });
    user.family = family._id as typeof user.family;
    await user.save();

    return (family._id as { toString(): string }).toString();
};

const FamilyService = {
    ensureFamily,

    getMyFamily: async (userId: string) => {
        const familyId = await ensureFamily(userId);

        const [family, members, invites] = await Promise.all([
            Family.findById(familyId),
            User.find({ family: familyId }).select("name email isVerified").sort({ createdAt: 1 }),
            FamilyInvite.find({ family: familyId, status: "pending" }).select("email createdAt expiresAt"),
        ]);

        return { family, members, pendingInvites: invites };
    },

    updateFamily: async (userId: string, name: string) => {
        const familyId = await ensureFamily(userId);
        const family = await Family.findByIdAndUpdate(familyId, { $set: { name } }, { new: true });

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "updated",
            entity: "family",
            entityId: familyId,
            summary: `Renamed the family to "${name}"`,
        });

        return family;
    },

    inviteMember: async (userId: string, email: string) => {
        const familyId = await ensureFamily(userId);
        const normalisedEmail = email.toLowerCase().trim();

        const existing = await User.findOne({ email: normalisedEmail });
        if (existing?.family?.toString() === familyId)
            throw new ConflictError("That person is already in this family");

        // A user belongs to exactly one family, so joining a second would mean
        // abandoning their existing data. Blocked rather than silently moved.
        if (existing?.family)
            throw new ConflictError("That person already belongs to another family");

        const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

        // Re-inviting the same address refreshes and resends the existing
        // invite rather than erroring -- that's what pressing "invite" again
        // is meant to do, and it recovers from a failed first delivery.
        let invite = await FamilyInvite.findOne({
            family: familyId,
            email: normalisedEmail,
            status: "pending",
        });
        const isResend = Boolean(invite);

        if (invite) {
            invite.token = crypto.randomBytes(32).toString("hex");
            invite.expiresAt = expiresAt;
            invite.invitedBy = userId as unknown as typeof invite.invitedBy;
            await invite.save();
        } else {
            invite = await FamilyInvite.create({
                family: familyId,
                email: normalisedEmail,
                invitedBy: userId,
                token: crypto.randomBytes(32).toString("hex"),
                expiresAt,
            });
        }

        const family = await Family.findById(familyId);

        // The invite is already persisted and valid, so a mail outage must not
        // fail the request -- that would leave a pending invite the caller
        // believes doesn't exist. Report delivery separately instead.
        let emailSent = true;
        try {
            await sendFamilyInviteEmail(normalisedEmail, invite.token, family?.name ?? "a family");
        } catch (error) {
            emailSent = false;
            console.error("Failed to send family invite email:", error);
        }

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "created",
            entity: "familyInvite",
            entityId: invite._id as string,
            summary: isResend
                ? `Resent the invite for ${normalisedEmail}`
                : `Invited ${normalisedEmail} to the family`,
        });

        return { email: normalisedEmail, expiresAt, emailSent };
    },

    revokeInvite: async (userId: string, inviteId: string) => {
        const familyId = await ensureFamily(userId);

        const invite = await FamilyInvite.findOne({ _id: inviteId, family: familyId, status: "pending" });
        if (!invite)
            throw new NotFoundError("Pending invite not found");

        invite.status = "revoked";
        await invite.save();

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "deleted",
            entity: "familyInvite",
            entityId: invite._id as string,
            summary: `Revoked the invite for ${invite.email}`,
        });
    },

    acceptInvite: async (userId: string, token: string) => {
        const user = await User.findById(userId);
        if (!user)
            throw new NotFoundError("User not found");

        const invite = await FamilyInvite.findOne({ token, status: "pending" });
        if (!invite)
            throw new ValidationError("This invite is not valid or has already been used");

        if (invite.expiresAt < new Date())
            throw new ValidationError("This invite has expired");

        if (invite.email !== user.email.toLowerCase())
            throw new ValidationError("This invite was sent to a different email address");

        // Joining would orphan whatever the user already recorded under their
        // own family, so require an explicit leave first rather than guessing.
        const currentFamilyId = user.family?.toString();
        if (currentFamilyId && currentFamilyId !== invite.family.toString()) {
            const otherMembers = await User.countDocuments({ family: currentFamilyId, _id: { $ne: user._id } });
            if (otherMembers > 0)
                throw new ConflictError("You already belong to another family with members. Leave it before joining a new one.");
        }

        user.family = invite.family;
        await user.save();

        invite.status = "accepted";
        await invite.save();

        await ActivityLogService.record({
            familyId: invite.family,
            actorId: userId,
            action: "created",
            entity: "familyMember",
            entityId: user._id as string,
            summary: "joined the family",
        });

        return Family.findById(invite.family);
    },

    removeMember: async (userId: string, memberId: string) => {
        const familyId = await ensureFamily(userId);

        const member = await User.findOne({ _id: memberId, family: familyId });
        if (!member)
            throw new NotFoundError("Member not found in this family");

        const family = await Family.findById(familyId);
        if (family?.createdBy.toString() === memberId)
            throw new ValidationError("The family creator cannot be removed");

        // Removing someone leaves their past entries in place, attributed to
        // them -- deleting shared history would distort everyone's reports.
        member.family = undefined;
        await member.save();

        await ActivityLogService.record({
            familyId,
            actorId: userId,
            action: "deleted",
            entity: "familyMember",
            entityId: member._id as string,
            summary: `Removed ${member.name} from the family`,
        });
    },
};

export default FamilyService;
