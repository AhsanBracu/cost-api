import mongoose, { Schema } from "mongoose";
import { IdailyInsight } from "./types/IDailyInsight";

// Declared as sub-schemas rather than inline objects: Mongoose's typed
// SchemaDefinition can't map a nested interface, and failing to do so breaks
// inference for every field in the parent. `_id: false` keeps them as plain
// embedded values rather than documents with their own ids.
const NarrativeSchema = new Schema({
    mainDriver: { type: String, required: true },
    explanation: { type: String, required: true },
    suggestions: { type: [String], default: [] },
}, { _id: false });

// A typed sub-schema rather than `[Schema.Types.Mixed]`: the array-of-Mixed
// form has no valid TypeScript mapping, and one unmappable field makes the
// compiler reject every other field in the parent schema too.
const ToolCallSchema = new Schema({
    name: { type: String, required: true },
    input: { type: Schema.Types.Mixed },
}, { _id: false });

const FingerprintSchema = new Schema({
    costCount: { type: Number, required: true },
    lastModified: { type: Date, default: null },
}, { _id: false });

const DailyInsightSchema: Schema<IdailyInsight> = new Schema({
    family: { type: Schema.Types.ObjectId, ref: "Family", required: true },
    date: { type: Date, required: true },
    narrative: { type: NarrativeSchema, required: true },
    toolCalls: { type: [ToolCallSchema], default: [] },
    fingerprint: { type: FingerprintSchema, required: true },
}, { timestamps: true });

// One insight per family per day -- a recompute overwrites rather than piles up.
DailyInsightSchema.index({ family: 1, date: 1 }, { unique: true });

const DailyInsight = mongoose.model<IdailyInsight>("DailyInsight", DailyInsightSchema);

export default DailyInsight;
