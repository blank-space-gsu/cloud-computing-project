import {
  PRODUCTIVITY_MONTHLY_TREND_PERIODS,
  PRODUCTIVITY_WEEKLY_TREND_PERIODS
} from "../constants/productivity.js";

const parseIsoDate = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatIsoDate = (value) => value.toISOString().slice(0, 10);

const addUtcDays = (value, days) => {
  const result = new Date(value.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const addUtcMonths = (value, months) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));

export const getTodayIsoDate = () => formatIsoDate(new Date());

export const getWeekRange = (referenceDate) => {
  const parsedReferenceDate = parseIsoDate(referenceDate);
  const weekdayOffset = (parsedReferenceDate.getUTCDay() + 6) % 7;
  const startDate = addUtcDays(parsedReferenceDate, -weekdayOffset);
  const endDate = addUtcDays(startDate, 6);

  return {
    startDate: formatIsoDate(startDate),
    endDate: formatIsoDate(endDate)
  };
};

export const getMonthRange = (referenceDate) => {
  const parsedReferenceDate = parseIsoDate(referenceDate);
  const startDate = new Date(
    Date.UTC(parsedReferenceDate.getUTCFullYear(), parsedReferenceDate.getUTCMonth(), 1)
  );
  const endDate = new Date(
    Date.UTC(parsedReferenceDate.getUTCFullYear(), parsedReferenceDate.getUTCMonth() + 1, 0)
  );

  return {
    startDate: formatIsoDate(startDate),
    endDate: formatIsoDate(endDate)
  };
};

export const getYearRange = (referenceDate) => {
  const parsedReferenceDate = parseIsoDate(referenceDate);
  const year = parsedReferenceDate.getUTCFullYear();

  return {
    startDate: formatIsoDate(new Date(Date.UTC(year, 0, 1))),
    endDate: formatIsoDate(new Date(Date.UTC(year, 11, 31)))
  };
};

export const getWeeklyTrendRanges = (
  referenceDate,
  count = PRODUCTIVITY_WEEKLY_TREND_PERIODS
) => {
  const currentWeek = getWeekRange(referenceDate);
  const currentWeekStartDate = parseIsoDate(currentWeek.startDate);

  return Array.from({ length: count }, (_value, index) => {
    const weeksBack = count - index - 1;
    const startDate = addUtcDays(currentWeekStartDate, weeksBack * -7);

    return {
      startDate: formatIsoDate(startDate),
      endDate: formatIsoDate(addUtcDays(startDate, 6))
    };
  });
};

export const getMonthlyTrendRanges = (
  referenceDate,
  count = PRODUCTIVITY_MONTHLY_TREND_PERIODS
) => {
  const currentMonth = getMonthRange(referenceDate);
  const currentMonthStartDate = parseIsoDate(currentMonth.startDate);

  return Array.from({ length: count }, (_value, index) => {
    const monthsBack = count - index - 1;
    const startDate = addUtcMonths(currentMonthStartDate, monthsBack * -1);
    const endDate = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0)
    );

    return {
      startDate: formatIsoDate(startDate),
      endDate: formatIsoDate(endDate)
    };
  });
};

export const buildProductivityRanges = (referenceDate) => ({
  weekly: getWeekRange(referenceDate),
  monthly: getMonthRange(referenceDate),
  yearly: getYearRange(referenceDate),
  weeklyTrend: getWeeklyTrendRanges(referenceDate),
  monthlyTrend: getMonthlyTrendRanges(referenceDate)
});
