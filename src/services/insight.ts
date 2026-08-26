import { Types } from "mongoose";
import Cost from "../models/CostModel";

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

const getTotalsForRange = async (userId: string, start: Date, end: Date): Promise<CurrencyTotal[]> => {
    return Cost.aggregate([
        { $match: { user: new Types.ObjectId(userId), isDeleted: false, date: { $gte: start, $lte: end } } },
        { $group: { _id: "$currency", total: { $sum: "$amount" } } },
        { $project: { _id: 0, currency: "$_id", total: 1 } },
    ]);
};

const InsightService = {
    getDailyComparison: async (userId: string, referenceDate?: Date) => {
        const today = referenceDate ?? new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const lastMonthSameDay = getSameDayLastMonth(today);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);

        const [todayTotals, yesterdayTotals, lastMonthTotals, monthToDateTotals] = await Promise.all([
            getTotalsForRange(userId, startOfDay(today), endOfDay(today)),
            getTotalsForRange(userId, startOfDay(yesterday), endOfDay(yesterday)),
            getTotalsForRange(userId, startOfDay(lastMonthSameDay), endOfDay(lastMonthSameDay)),
            getTotalsForRange(userId, monthStart, endOfDay(today)),
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
};

export default InsightService;
