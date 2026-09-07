"use client";

import { useCallback } from "react";
import { useFormatter, type DateTimeFormatOptions } from "next-intl";

/**
 * Calendar dates in a plan ("2026-10-02") are days in the destination, not
 * instants. Formatting them through a Date built at local midnight shifts them
 * a day back for anyone east of the formatter's time zone (next-intl inherits
 * the server's zone, UTC on Vercel, so Israeli users saw every date one day
 * early). Build them at UTC midnight and format in UTC: the same day everywhere.
 */
export function formatCalendarDate(format: { dateTime: (d: Date, o: DateTimeFormatOptions) => string }, iso: string, options: DateTimeFormatOptions): string {
  return format.dateTime(new Date(`${iso.slice(0, 10)}T00:00:00Z`), { ...options, timeZone: "UTC" });
}

export function useCalendarFormat() {
  const format = useFormatter();
  return useCallback((iso: string, options: DateTimeFormatOptions) => formatCalendarDate(format, iso, options), [format]);
}
