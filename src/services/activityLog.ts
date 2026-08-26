import { Types } from "mongoose";
import ActivityLog from "../models/ActivityLogModel";
import { ActivityAction, ActivityEntity } from "../models/types/IActivityLog";

interface RecordInput {
    familyId: string | Types.ObjectId;
    actorId: string | Types.ObjectId;
    action: ActivityAction;
    entity: ActivityEntity;
    entityId?: string | Types.ObjectId;
    summary: string;
}

const ActivityLogService = {
    /**
     * Any family member can edit anyone's data, so the log is what makes that
     * safe -- it answers "who changed this". Deliberately never throws: an
     * audit write failing must not fail the user's actual action.
     */
    record: async (input: RecordInput) => {
        try {
            await ActivityLog.create({
                family: input.familyId,
                actor: input.actorId,
                action: input.action,
                entity: input.entity,
                entityId: input.entityId,
                summary: input.summary,
            });
        } catch (error) {
            console.error("Failed to write activity log entry:", error);
        }
    },

    list: async (familyId: string, options: { limit: number; page: number }) => {
        const skip = (options.page - 1) * options.limit;

        const [items, total] = await Promise.all([
            ActivityLog.find({ family: familyId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(options.limit)
                .populate("actor", "name email"),
            ActivityLog.countDocuments({ family: familyId }),
        ]);

        return {
            items,
            total,
            page: options.page,
            limit: options.limit,
            totalPages: Math.ceil(total / options.limit),
        };
    },
};

export default ActivityLogService;
