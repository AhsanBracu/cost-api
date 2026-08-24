import { Types } from "mongoose";
import Cost from "../models/CostModel";

interface DateRange {
    startDate?: Date;
    endDate?: Date;
}

const buildMatch = (userId: string, range: DateRange) => {
    const match: Record<string, unknown> = { user: new Types.ObjectId(userId), isDeleted: false };

    if (range.startDate || range.endDate) {
        match.date = {
            ...(range.startDate && { $gte: range.startDate }),
            ...(range.endDate && { $lte: range.endDate }),
        };
    }

    return match;
};

const getTotalsByCurrency = async (userId: string, range: { start: Date; end: Date }) => {
    return Cost.aggregate([
        { $match: { user: new Types.ObjectId(userId), isDeleted: false, date: { $gte: range.start, $lte: range.end } } },
        { $group: { _id: "$currency", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $project: { _id: 0, currency: "$_id", total: 1, count: 1 } },
        { $sort: { currency: 1 } },
    ]);
};

const getDailyBreakdown = async (userId: string, range: { start: Date; end: Date }) => {
    return Cost.aggregate([
        { $match: { user: new Types.ObjectId(userId), isDeleted: false, date: { $gte: range.start, $lte: range.end } } },
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
    getSummary: async (userId: string, range: DateRange) => {
        const match = buildMatch(userId, range);

        const [overall, byCategory, byPaymentMethod] = await Promise.all([
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
        ]);

        return { overall, byCategory, byPaymentMethod };
    },

    getTrend: async (userId: string, range: DateRange & { interval: "day" | "week" | "month" }) => {
        const match = buildMatch(userId, range);

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

    getCompare: async (userId: string, options: { granularity: "day" | "week" | "month"; days: number; referenceDate?: Date }) => {
        const reference = options.referenceDate ?? new Date();

        const [currentRange, previousRange] = options.granularity === "month"
            ? [getMonthRange(reference, 0), getMonthRange(reference, -1)]
            : options.granularity === "week"
            ? [getWeekRange(reference, 0), getWeekRange(reference, -1)]
            : [getDayWindow(reference, options.days, 0), getDayWindow(reference, options.days, -1)];

        const [currentTotals, previousTotals] = await Promise.all([
            getTotalsByCurrency(userId, currentRange),
            getTotalsByCurrency(userId, previousRange),
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
            getDailyBreakdown(userId, currentRange),
            getDailyBreakdown(userId, previousRange),
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
