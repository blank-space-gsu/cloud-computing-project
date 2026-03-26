import { z } from "zod";

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isRealCalendarDate = (value) => {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
};

export const isMondayDate = (value) =>
  isRealCalendarDate(value) &&
  new Date(`${value}T00:00:00.000Z`).getUTCDay() === 1;

export const isoDateSchema = z
  .string()
  .regex(ISO_DATE_PATTERN, "Date must use YYYY-MM-DD format.")
  .refine(isRealCalendarDate, {
    message: "Date must be a real calendar date."
  });

export const mondayDateSchema = isoDateSchema.refine(isMondayDate, {
  message: "weekStartDate must be a Monday."
});
