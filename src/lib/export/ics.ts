import type { GuestPlan } from "@/lib/guest/trips";

/**
 * iCalendar export: one VEVENT per activity, floating local times (the traveller's
 * calendar shows them as wall-clock times at the destination, which is what you want on a trip).
 */
type Options = {
  title: string;
  /** Localised activity names for non-visit kinds (meal, rest, ...) */
  kindLabel: (kind: string) => string;
  placeName: (id: string) => string;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function icsDateTime(date: string, minutes: number): string {
  const [y, m, d] = date.split("-");
  const h = Math.min(23, Math.floor(minutes / 60));
  const min = minutes % 60;
  return `${y}${m}${d}T${pad(h)}${pad(min)}00`;
}

/** Escape per RFC 5545: backslash, comma, semicolon, newline. */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines must not exceed 75 octets; fold with CRLF + space. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcs(plan: GuestPlan, opts: Options): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Triplan//Trip plan//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${icsEscape(opts.title)}`];
  for (const day of plan.itinerary.days) {
    for (const a of day.activities) {
      const place = a.placeId ? plan.places[a.placeId] : undefined;
      const summary = a.kind === "visit" && a.placeId ? opts.placeName(a.placeId) : opts.kindLabel(a.kind);
      const description = a.kind === "visit" && place ? `${place.nameLocal}${place.website ? `\n${place.website}` : ""}` : "";
      lines.push(
        "BEGIN:VEVENT",
        `UID:triplan-${day.date}-${a.id}@triplan`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDateTime(day.date, a.startMin)}`,
        `DTEND:${icsDateTime(day.date, a.endMin)}`,
        `SUMMARY:${icsEscape(summary)}`,
      );
      if (description) lines.push(`DESCRIPTION:${icsEscape(description)}`);
      if (place) {
        lines.push(`LOCATION:${icsEscape(place.nameLocal)}`, `GEO:${place.lat.toFixed(6)};${place.lng.toFixed(6)}`);
      }
      lines.push("END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
