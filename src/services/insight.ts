import { resolveFamilyId, assertOptionalFamilyMember, assertFamilyMember } from "./familyContext";
import { Types } from "mongoose";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import Cost from "../models/CostModel";
import { MonthlySpendLimit } from "../models/BudgetModel";
import DailyInsight from "../models/DailyInsightModel";
import { INSIGHT_MODEL, getLlmClient, isLlmConfigured } from "./llm";

interface CurrencyTotal {
    currency: string;
    total: number;
}

const startOfDay = (date: Date) => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
};

const endOfDay = (date: Date) => {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
};

// "Same day last month" can't just subtract one from the month index --
// e.g. March 31 minus one month would silently roll forward into March
// again (Feb has no 31st). Clamp to the last real day of the prior month.
const getSameDayLastMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    let targetYear = year;
    let targetMonth = month - 1;
    if (targetMonth < 0) {
        targetMonth = 11;
        targetYear -= 1;
    }

    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    return new Date(targetYear, targetMonth, Math.min(day, daysInTargetMonth));
};

const getTotalsForRange = async (familyId: string, start: Date, end: Date): Promise<CurrencyTotal[]> => {
    return Cost.aggregate([
        { $match: { family: new Types.ObjectId(familyId), isDeleted: false, date: { $gte: start, $lte: end } } },
        { $group: { _id: "$currency", total: { $sum: "$amount" } } },
        { $project: { _id: 0, currency: "$_id", total: 1 } },
    ]);
};

/** Today's spend split by category, so the model can see what moved. */
const getCategoryTotals = async (familyId: string, start: Date, end: Date) => {
    return Cost.aggregate([
        { $match: { family: new Types.ObjectId(familyId), isDeleted: false, date: { $gte: start, $lte: end } } },
        { $group: { _id: { category: "$category", currency: "$currency" }, total: { $sum: "$amount" } } },
        { $project: { _id: 0, category: "$_id.category", currency: "$_id.currency", total: 1 } },
        { $sort: { total: -1 } },
    ]);
};

/** The individual costs behind today's number -- usually one or two explain a spike. */
const getCostsForRange = async (familyId: string, start: Date, end: Date) => {
    return Cost.find({ family: familyId, isDeleted: false, date: { $gte: start, $lte: end } })
        .select("amount currency category place")
        .sort({ amount: -1 })
        .limit(10)
        .lean();
};

/**
 * What's left of the monthly limit, and what that allows per remaining day.
 *
 * Computed here rather than asked of the model: a recommendation the user acts
 * on has to be arithmetic, not a plausible-looking guess. The model is told
 * this number and may reference it, but never derives it.
 */
const getPacing = async (familyId: string, today: Date) => {
    const limit = await MonthlySpendLimit.findOne({
        family: familyId,
        member: null,
        year: today.getFullYear(),
        month: today.getMonth() + 1,
    });
    if (!limit) return null;

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    const monthTotals = await getTotalsForRange(familyId, monthStart, endOfDay(today));
    const monthToDate = monthTotals.find((t) => t.currency === limit.currency)?.total ?? 0;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    // Days after today -- "what can I spend tomorrow" excludes the day just spent.
    const daysRemaining = daysInMonth - today.getDate();
    const remaining = limit.amount - monthToDate;

    return {
        currency: limit.currency,
        monthlyLimit: limit.amount,
        monthToDate,
        remaining,
        daysRemaining,
        // On the last day of the month there is no "per remaining day".
        perDayRemaining: daysRemaining > 0 ? remaining / daysRemaining : null,
    };
};

/**
 * A cheap summary of the costs behind a day, used to decide whether a stored
 * insight still describes reality.
 *
 * Count alone would miss an edit that changed an amount; `lastModified` alone
 * would miss a deletion, since a removed row can't raise the maximum. Together
 * they catch adds, edits and deletes.
 */
const getFingerprint = async (familyId: string, day: Date) => {
    const [result] = await Cost.aggregate([
        {
            $match: {
                family: new Types.ObjectId(familyId),
                isDeleted: false,
                date: { $gte: startOfDay(day), $lte: endOfDay(day) },
            },
        },
        { $group: { _id: null, costCount: { $sum: 1 }, lastModified: { $max: "$updatedAt" } } },
        { $project: { _id: 0, costCount: 1, lastModified: 1 } },
    ]);

    return result ?? { costCount: 0, lastModified: null };
};

const isSameFingerprint = (
    a: { costCount: number; lastModified?: Date | null },
    b: { costCount: number; lastModified?: Date | null }
) => {
    if (a.costCount !== b.costCount) return false;
    const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
    const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
    return aTime === bTime;
};

/**
 * How many rounds of tool calls the model gets before we make it answer.
 *
 * A cap matters: nothing stops a model from asking for one more thing
 * forever, and every round is a full billable request carrying the whole
 * conversation so far. Three is enough to look at categories, then drill
 * into the costs behind them.
 */
const MAX_TOOL_ROUNDS = 3;

/**
 * One system prompt, reused by every request in the conversation.
 *
 * It must be byte-identical across the whole loop. The model's thinking blocks
 * are signed against the conversation that produced them -- system prompt
 * included -- so replaying them under a different prompt is rejected with
 * "The block is bound to a different conversation". Hoisting it to a constant
 * makes that impossible to get wrong by editing one call and not the other.
 */
const INSIGHT_SYSTEM =
    "You explain a household's daily spending to the person who spent it. " +
    "Investigate with the tools before concluding, but stop as soon as you " +
    "can name the cause -- two or three calls is plenty. Never calculate, " +
    "estimate or invent a figure: every number must come from the data or a " +
    "tool result. If spending is simply higher across the board with no " +
    "standout, say exactly that rather than inventing a cause.";

/** Which day a tool should look at. Named, so the model never handles dates. */
type DaySelector = "today" | "yesterday" | "last_month_same_day";

/**
 * What the model is allowed to ask for.
 *
 * These are descriptions, not code -- the model sees only the name, the
 * description and the input schema, and decides from those whether a tool is
 * worth calling. Write the descriptions for a reader who cannot see the
 * implementation, because that is exactly the model's situation.
 */
const INSIGHT_TOOLS: Anthropic.Tool[] = [
    {
        name: "get_category_totals",
        description:
            "Spending for one day, broken down by category. Use this first to see which " +
            "category moved between the days being compared.",
        input_schema: {
            type: "object",
            properties: {
                day: {
                    type: "string",
                    enum: ["today", "yesterday", "last_month_same_day"],
                    description: "Which day to total up",
                },
            },
            required: ["day"],
            additionalProperties: false,
        },
    },
    {
        name: "get_top_costs",
        description:
            "The individual purchases for one day, largest first. Use this after " +
            "get_category_totals to find the specific purchase behind a category's increase.",
        input_schema: {
            type: "object",
            properties: {
                day: {
                    type: "string",
                    enum: ["today", "yesterday", "last_month_same_day"],
                    description: "Which day to list purchases for",
                },
            },
            required: ["day"],
            additionalProperties: false,
        },
    },
    {
        name: "get_budget_pacing",
        description:
            "The household's monthly spending limit, how much of it is already spent, and " +
            "how much per day is left for the rest of the month. Returns null if no limit " +
            "is set. Use this before suggesting how much to spend next.",
        input_schema: { type: "object", properties: {}, additionalProperties: false },
    },
];

/**
 * Runs the tool the model asked for and returns real rows.
 *
 * Note what this preserves: the numbers still come from MongoDB via the same
 * aggregations as before. Tool calling changes *who decides which query runs*,
 * not who does the arithmetic -- the model still never computes anything.
 */
const runInsightTool = async (
    familyId: string,
    today: Date,
    name: string,
    input: Record<string, unknown>
) => {
    const dayFor = (selector: DaySelector) => {
        if (selector === "yesterday") {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return yesterday;
        }
        if (selector === "last_month_same_day") return getSameDayLastMonth(today);
        return today;
    };

    switch (name) {
        case "get_category_totals": {
            const day = dayFor(input.day as DaySelector);
            return getCategoryTotals(familyId, startOfDay(day), endOfDay(day));
        }
        case "get_top_costs": {
            const day = dayFor(input.day as DaySelector);
            return getCostsForRange(familyId, startOfDay(day), endOfDay(day));
        }
        case "get_budget_pacing":
            return getPacing(familyId, today);
        default:
            // Models do occasionally invent a tool name. Say so rather than
            // throwing -- it can correct itself on the next turn.
            return { error: `No such tool: ${name}` };
    }
};

/**
 * The qualitative half of the insight -- the only part the model produces.
 * Every number stays in the deterministic payload above.
 */
const NarrativeSchema = z.object({
    mainDriver: z.string().describe("The single biggest reason today differs from the days compared against"),
    explanation: z.string().describe("Two or three sentences a person would actually say"),
    suggestions: z.array(z.string()).describe("Concrete, specific actions for the next few days"),
});

const InsightService = {
    getDailyComparison: async (userId: string, referenceDate?: Date) => {
        const familyId = await resolveFamilyId(userId);
        const today = referenceDate ?? new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const lastMonthSameDay = getSameDayLastMonth(today);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);

        const [todayTotals, yesterdayTotals, lastMonthTotals, monthToDateTotals] = await Promise.all([
            getTotalsForRange(familyId, startOfDay(today), endOfDay(today)),
            getTotalsForRange(familyId, startOfDay(yesterday), endOfDay(yesterday)),
            getTotalsForRange(familyId, startOfDay(lastMonthSameDay), endOfDay(lastMonthSameDay)),
            getTotalsForRange(familyId, monthStart, endOfDay(today)),
        ]);

        const currencies = new Set([
            ...todayTotals.map((t) => t.currency),
            ...yesterdayTotals.map((t) => t.currency),
            ...lastMonthTotals.map((t) => t.currency),
            ...monthToDateTotals.map((t) => t.currency),
        ]);

        const comparison = Array.from(currencies).sort().map((currency) => {
            const todayTotal = todayTotals.find((t) => t.currency === currency)?.total ?? 0;
            const yesterdayTotal = yesterdayTotals.find((t) => t.currency === currency)?.total ?? 0;
            const lastMonthTotal = lastMonthTotals.find((t) => t.currency === currency)?.total ?? 0;
            const monthToDateTotal = monthToDateTotals.find((t) => t.currency === currency)?.total ?? 0;

            return {
                currency,
                today: todayTotal,
                yesterday: yesterdayTotal,
                lastMonthSameDay: lastMonthTotal,
                monthToDate: monthToDateTotal,
                vsYesterday: todayTotal - yesterdayTotal,
                vsLastMonthSameDay: todayTotal - lastMonthTotal,
            };
        });

        return {
            date: startOfDay(today),
            comparedTo: { yesterday: startOfDay(yesterday), lastMonthSameDay: startOfDay(lastMonthSameDay) },
            comparison,
        };
    },

    /**
     * The daily comparison, plus an explanation the model investigates for itself.
     *
     * The exact figures are computed up front and handed over as fact. What the
     * model decides is *which follow-up questions to ask* -- whether the cause is
     * worth chasing into categories, into individual purchases, or not at all.
     * That varies day to day, which is the case for letting it choose rather than
     * running every query every time.
     *
     * Written as an explicit loop rather than the SDK's `toolRunner` helper,
     * because the loop is the thing worth seeing: a request comes back asking for
     * a tool, you run it, you send the answer back, and you repeat until it stops
     * asking. "Agent" is that paragraph, nothing more.
     */
    getDailyInsight: async (userId: string, referenceDate?: Date, options: { generate?: boolean } = {}) => {
        const { generate = false } = options;
        const familyId = await resolveFamilyId(userId);
        const today = referenceDate ?? new Date();
        const day = startOfDay(today);

        const facts = await InsightService.getDailyComparison(userId, today);

        if (!isLlmConfigured())
            return { ...facts, narrative: null, toolCalls: [], cached: false, stillCurrent: true };

        // Once a day has an insight, that row is what gets served -- including
        // when costs have changed since. Going stale is reported, not acted on:
        // a recompute costs real money and about ten seconds, so it happens
        // only when someone explicitly asks via forceRefresh.
        const fingerprint = await getFingerprint(familyId, today);
        const stored = await DailyInsight.findOne({ family: familyId, date: day });

        if (stored && !generate) {
            return {
                ...facts,
                narrative: stored.narrative,
                toolCalls: stored.toolCalls,
                cached: true,
                // False means costs were added, edited or deleted after this
                // text was written -- the frontend's cue to offer a refresh.
                stillCurrent: isSameFingerprint(fingerprint, stored.fingerprint),
                generatedAt: stored.updatedAt,
            };
        }

        if (!generate) {
            return {
                ...facts,
                narrative: null,
                toolCalls: [],
                cached: false,
                stillCurrent: true,
                generatedAt: null,
            };
        }

        const client = getLlmClient();

        // The whole conversation, rebuilt and resent on every request -- the API
        // keeps no memory between calls. This array growing is why a long tool
        // loop costs more than a short one.
        const messages: Anthropic.MessageParam[] = [
            {
                role: "user",
                content:
                    "Here are today's spending totals for a household, already calculated:\n\n" +
                    JSON.stringify(facts, null, 2) +
                    "\n\nWork out why today differs from the days it is compared against. " +
                    "Use the tools to investigate, then explain what you found.",
            },
        ];

        // Recorded so the response can show which tools the model chose -- the
        // part you asked to be able to watch.
        const toolCalls: { name: string; input: unknown }[] = [];

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const response = await client.messages.create({
                model: INSIGHT_MODEL,
                max_tokens: 16000,
                output_config: { effort: "low" },
                system: INSIGHT_SYSTEM,
                tools: INSIGHT_TOOLS,
                messages,
            });

            // Anything other than a tool request means it's done investigating.
            if (response.stop_reason !== "tool_use") break;

            // The assistant turn must go back verbatim, tool_use blocks included --
            // each tool_result below is matched to one of them by id.
            messages.push({ role: "assistant", content: response.content });

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of response.content) {
                if (block.type !== "tool_use") continue;

                toolCalls.push({ name: block.name, input: block.input });
                const result = await runInsightTool(
                    familyId,
                    today,
                    block.name,
                    block.input as Record<string, unknown>
                );

                toolResults.push({
                    type: "tool_result",
                    tool_use_id: block.id,
                    content: JSON.stringify(result),
                });
            }

            // All results from one turn go back in a single user message. Splitting
            // them across several messages teaches the model to stop asking for
            // things in parallel.
            messages.push({ role: "user", content: toolResults });
        }

        // One last pass with no tools offered, purely to shape what it found into
        // the JSON the frontend renders. tool_choice "none" keeps the earlier
        // tool_use blocks in the history valid while forbidding further calls.
        const final = await client.messages.parse({
            model: INSIGHT_MODEL,
            max_tokens: 16000,
            output_config: { effort: "low", format: zodOutputFormat(NarrativeSchema) },
            system: INSIGHT_SYSTEM,
            tools: INSIGHT_TOOLS,
            tool_choice: { type: "none" },
            messages: [
                ...messages,
                { role: "user", content: "Now summarise what you found." },
            ],
        });

        const narrative = final.parsed_output ?? null;

        // Only a well-formed narrative is worth storing -- caching a null would
        // mean never retrying a day that happened to fail once.
        if (narrative) {
            await DailyInsight.findOneAndUpdate(
                { family: familyId, date: day },
                { $set: { narrative, toolCalls, fingerprint } },
                { upsert: true, new: true }
            );
        }

        // Freshly generated, so by definition it matches the costs just read.
        return { ...facts, narrative, toolCalls, cached: false, stillCurrent: true, generatedAt: new Date() };
    },
};

export default InsightService;
