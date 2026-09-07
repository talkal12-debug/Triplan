import { describe, expect, it } from "vitest";
import { createFormatter } from "next-intl";
import { formatCalendarDate } from "@/lib/i18n/use-calendar-format";

/**
 * A plan's dates are destination days. Whatever time zone the formatter runs in
 * (the server's UTC on Vercel, a viewer in Israel or in Samoa), "2026-10-02"
 * must read as the 2nd of October, never the 1st.
 */
describe("formatCalendarDate", () => {
  const zones = ["UTC", "Asia/Jerusalem", "Pacific/Kiritimati", "Pacific/Pago_Pago", "America/Los_Angeles"];
  it.each(zones)("keeps the calendar day in %s", (timeZone) => {
    const format = createFormatter({ locale: "en", timeZone });
    expect(formatCalendarDate(format, "2026-10-02", { day: "numeric", month: "short" })).toBe("Oct 2");
    expect(formatCalendarDate(format, "2026-10-02", { weekday: "long" })).toBe("Friday");
    expect(formatCalendarDate(format, "2026-01-01", { month: "long", year: "numeric" })).toBe("January 2026");
  });

  it("accepts a date-time string and uses its date part", () => {
    const format = createFormatter({ locale: "en", timeZone: "Asia/Tokyo" });
    expect(formatCalendarDate(format, "2026-10-03T18:30", { day: "numeric", month: "short" })).toBe("Oct 3");
  });

  it("shows the bug the plain local-midnight Date has east of UTC", () => {
    // The old code: new Date("2026-10-02T00:00:00") is local midnight; formatted in UTC it is still the 1st
    // for a process running east of Greenwich. Only assert when the machine is east of UTC.
    const local = new Date("2026-10-02T00:00:00");
    if (local.getTimezoneOffset() < 0) {
      const format = createFormatter({ locale: "en", timeZone: "UTC" });
      expect(format.dateTime(local, { day: "numeric" })).toBe("1");
    }
  });
});
