/**
 * One-off maintenance: bring the database's indexes in line with the schemas.
 *
 * Mongoose creates new indexes on its own but never removes old ones, so
 * indexes from an earlier shape of a model survive a migration. After the move
 * from per-user to per-family data, several `user`-based unique indexes were
 * left behind on documents that no longer have a `user` field -- every row
 * then indexed as `user: null` and the second one collided.
 *
 * Run with: npm run sync-indexes
 */
import mongoose from "mongoose";
import { monguri } from "../db_connect";

import Cost from "../models/CostModel";
import Income from "../models/IncomeModel";
import Category from "../models/CategoryModel";
import { CategoryBudget, MonthlySpendLimit } from "../models/BudgetModel";
import SavingsGoal from "../models/SavingsGoalModel";
import User from "../models/UserModel";
import { Family, FamilyInvite } from "../models/FamilyModel";
import ActivityLog from "../models/ActivityLogModel";

const MODELS = [
    Cost,
    Income,
    Category,
    CategoryBudget,
    MonthlySpendLimit,
    SavingsGoal,
    User,
    Family,
    FamilyInvite,
    ActivityLog,
];

const run = async () => {
    await mongoose.connect(monguri);

    for (const model of MODELS) {
        // syncIndexes returns the names it dropped, which is the interesting part.
        const dropped = await model.syncIndexes();
        console.log(
            dropped.length
                ? `${model.collection.name}: dropped ${dropped.join(", ")}`
                : `${model.collection.name}: already in sync`
        );
    }

    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error("Index sync failed:", error);
    await mongoose.disconnect();
    process.exit(1);
});
