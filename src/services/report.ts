import { Types } from "mongoose";
import Cost from "../models/CostModel";
import { resolveFamilyId } from "./familyContext";

interface DateRange {
    startDate?: Date;
    endDate?: Date;
}

/**
 * Narrows a report to one person. `forWhom: "shared"` selects household costs,
 * which are stored with a null forWhom. Omitting both covers the whole family.
 */
export interface AttributionFilter {
    paidBy?: string;
    forWhom?: string;
}

const applyAttribution = (match: Record<string, unknown>, filter: AttributionFilter = {}) => {
    if (filter.paidBy)
        match.paidBy = new Types.ObjectId(filter.paidBy);

    if (filter.forWhom)
        match.forWhom = filter.forWhom === "shared" ? null : new Types.ObjectId(filter.forWhom);

    return match;
};

const buildMatch = (familyId: string, range: DateRange, filter?: AttributionFilter) => {
    const match: Record<string, unknown> = { family: new Types.ObjectId(familyId), isDeleted: false };

    if (range.startDate || range.endDate) {
        match.date = {
            ...(range.startDate && { $gte: range.startDate }),
            ...(range.endDate && { $lte: range.endDate }),
        };
    }

    return applyAttribution(match, filter);
};

const rangeMatch = (familyId: string, range: { start: Date; end: Date }, filter?: AttributionFilter) =>
    applyAttribution(
        {
            family: new Types.ObjectId(familyId),
            isDeleted: false,
            date: { $gte: range.start, $lte: range.end },
        },
        filter
    );

const getTotalsByCurrency = async (
    familyId: string,
    range: { start: Date; end: Date },
    filter?: AttributionFilter
) => {
    return Cost.aggregate([
        { $match: rangeMatch(familyId, range, filter) },
        { $group: { _id: "$currency", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $project: { _id: 0, currency: "$_id", total: 1, count: 1 } },
        { $sort: { currency: 1 } },
    ]);
};

const getDailyBreakdown = async (
    familyId: string,
    range: { start: Date; end: Date },
    filter?: AttributionFilter
) => {
    return Cost.aggregate([
        { $match: rangeMatch(familyId, range, filter) },
        {
            $group: {
                _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, currency: "$currency" },
                total: { $sum: "$amount" },
                count: { $sum: 1 },
            },
        },
        { $project: { _id: 0, date: "$_id.date", currency: "$_id.currency", total: 1, count: 1 } },
        { $sort: { date: 1, currency: 1 } },
    ]);
};

/**
 * Spending grouped by person. `field` picks the question being asked:
 * forWhom answers "how much went on each person" (with a `shared` bucket for
 * household costs), paidBy answers "how much did each person pay out".
 */
const groupByPerson = async (match: Record<string, unknown>, field: "forWhom" | "paidBy") => {
    const rows = await Cost.aggregate([
        { $match: match },
        { $group: { _id: { person: `$${field}`, currency: "$currency" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
        {
            $lookup: {
                from: "users",
                localField: "_id.person",
                foreignField: "_id",
                as: "person",
            },
        },
        {
            $project: {
                _id: 0,
                // A null person is a shared household cost, not a missing user.
                memberId: "$_id.person",
                name: { $ifNull: [{ $arrayElemAt: ["$person.name", 0] }, "Shared"] },
                currency: "$_id.currency",
                total: 1,
                count: 1,
            },
        },
        { $sort: { name: 1, currency: 1 } },
    ]);

    return rows;
};

interface CurrencyTotal {
    currency: string;
    total: number;
    count: number;
}

const computeChanges = (current: CurrencyTotal[], previous: CurrencyTotal[]) => {
    const currencies = new Set([...current.map(c => c.currency), ...previous.map(c => c.currency)]);

    return Array.from(currencies).sort().map(currency => {
        const currentTotal = current.find(c => c.currency === currency)?.total ?? 0;
        const previousTotal = previous.find(c => c.currency === currency)?.total ?? 0;
        const diff = currentTotal - previousTotal;
        const percentChange = previousTotal === 0 ? null : Math.round((diff / previousTotal) * 10000) / 100;

        return { currency, currentTotal, previousTotal, diff, percentChange };
    });
};

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

const getMonthRange = (reference: Date, offsetMonths: number) => ({
    start: new Date(reference.getFullYear(), reference.getMonth() + offsetMonths, 1, 0, 0, 0, 0),
    end: new Date(reference.getFullYear(), reference.getMonth() + offsetMonths + 1, 0, 23, 59, 59, 999),
});

const getWeekRange = (reference: Date, offsetWeeks: number) => {
    const day = reference.getDay();
    const isoDay = day === 0 ? 7 : day;
    const monday = startOfDay(reference);
    monday.setDate(reference.getDate() - (isoDay - 1) + offsetWeeks * 7);
    const sunday = endOfDay(new Date(monday));
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: sunday };
};

const DAY_MS = 24 * 60 * 60 * 1000;

const getDayWindow = (reference: Date, days: number, offsetWindows: number) => {
    const end = endOfDay(new Date(reference.getTime() + offsetWindows * days * DAY_MS));
    const start = startOfDay(new Date(end.getTime() - (days - 1) * DAY_MS));
    return { start, end };
};

const ReportService = {
    getSummary: async (userId: string, range: DateRange, filter?: AttributionFilter) => {
        const familyId = await resolveFamilyId(userId);
        const match = buildMatch(familyId, range, filter);

        const [overall, byCategory, byPaymentMethod, byPerson, byPayer] = await Promise.all([
            Cost.aggregate([
                { $match: match },
                { $group: { _id: "$currency", total: { $sum: "$amount" }, count: { $sum: 1 } } },
                { $project: { _id: 0, currency: "$_id", total: 1, count: 1 } },
                { $sort: { currency: 1 } },
            ]),
            Cost.aggregate([
                { $match: match },
                { $group: { _id: { category: "$category", currency: "$currency" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
                { $project: { _id: 0, category: "$_id.category", currency: "$_id.currency", total: 1, count: 1 } },
                { $sort: { category: 1, currency: 1 } },
            ]),
            Cost.aggregate([
                { $match: match },
                { $group: { _id: { paymentMethod: "$paymentMethod", currency: "$currency" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
                { $project: { _id: 0, paymentMethod: "$_id.paymentMethod", currency: "$_id.currency", total: 1, count: 1 } },
                { $sort: { paymentMethod: 1, currency: 1 } },
            ]),
            groupByPerson(match, "forWhom"),
            groupByPerson(match, "paidBy"),
        ]);

        return { overall, byCategory, byPaymentMethod, byPerson, byPayer };
    },

    getTrend: async (
        userId: string,
        range: DateRange & { interval: "day" | "week" | "month" },
        filter?: AttributionFilter
    ) => {
        const familyId = await resolveFamilyId(userId);
        const match = buildMatch(familyId, range, filter);

        const dateFormat = range.interval === "day" ? "%Y-%m-%d" : range.interval === "week" ? "%G-W%V" : "%Y-%m";

        const data = await Cost.aggregate([
            { $match: match },
            {
                $group: {
                    _id: { period: { $dateToString: { format: dateFormat, date: "$date" } }, currency: "$currency" },
                    total: { $sum: "$amount" },
                    count: { $sum: 1 },
                },
            },
            { $project: { _id: 0, period: "$_id.period", currency: "$_id.currency", total: 1, count: 1 } },
            { $sort: { period: 1, currency: 1 } },
        ]);

        return { interval: range.interval, data };
    },

    getCompare: async (
        userId: string,
        options: { granularity: "day" | "week" | "month"; days: number; referenceDate?: Date },
        filter?: AttributionFilter
    ) => {
        const familyId = await resolveFamilyId(userId);
        const reference = options.referenceDate ?? new Date();

        const [currentRange, previousRange] = options.granularity === "month"
            ? [getMonthRange(reference, 0), getMonthRange(reference, -1)]
            : options.granularity === "week"
            ? [getWeekRange(reference, 0), getWeekRange(reference, -1)]
            : [getDayWindow(reference, options.days, 0), getDayWindow(reference, options.days, -1)];

        const [currentTotals, previousTotals] = await Promise.all([
            getTotalsByCurrency(familyId, currentRange, filter),
            getTotalsByCurrency(familyId, previousRange, filter),
        ]);

        const changes = computeChanges(currentTotals, previousTotals);

        if (options.granularity !== "day") {
            return {
                granularity: options.granularity,
                current: { start: currentRange.start, end: currentRange.end, totals: currentTotals },
                previous: { start: previousRange.start, end: previousRange.end, totals: previousTotals },
                changes,
            };
        }

        const [currentDaily, previousDaily] = await Promise.all([
            getDailyBreakdown(familyId, currentRange, filter),
            getDailyBreakdown(familyId, previousRange, filter),
        ]);

        return {
            granularity: options.granularity,
            days: options.days,
            current: { start: currentRange.start, end: currentRange.end, totals: currentTotals, daily: currentDaily },
            previous: { start: previousRange.start, end: previousRange.end, totals: previousTotals, daily: previousDaily },
            changes,
        };
    },
};

export default ReportService;
