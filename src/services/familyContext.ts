import User from "../models/UserModel";
import { ValidationError } from "../errors/AppError";
import FamilyService from "./family";

/**
 * Resolves the family a request acts within. Every data service scopes its
 * queries by this rather than by user id, so all members see one shared set
 * of costs, budgets and reports.
 */
export const resolveFamilyId = (userId: string) => FamilyService.ensureFamily(userId);

/**
 * A member reference on an entry (paidBy / forWhom / earnedBy / member) must
 * point at someone actually in the family -- otherwise a stray id would
 * silently attribute spending to a stranger.
 */
export const assertFamilyMember = async (familyId: string, memberId: string, field: string) => {
    const member = await User.findOne({ _id: memberId, family: familyId }).select("_id");
    if (!member)
        throw new ValidationError(`${field} must be a member of your family`);
};

/**
 * Optional member fields treat null/undefined as "the household", so only a
 * provided value needs checking.
 */
export const assertOptionalFamilyMember = async (
    familyId: string,
    memberId: string | null | undefined,
    field: string
) => {
    if (memberId === null || memberId === undefined) return;
    await assertFamilyMember(familyId, memberId, field);
};
