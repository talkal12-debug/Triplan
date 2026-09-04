import type { GuestPlan } from "@/lib/guest/trips";

/** GPX / KML export: waypoints for every stop, one track/path per day. */
type Options = { title: string; placeName: (id: string) => string; dayLabel: (index: number) => string };

export function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Stop = { dayIndex: number; order: number; id: string; name: string; local: string; lat: number; lng: number; start: number };

function stops(plan: GuestPlan, opts: Options): Stop[] {
  const out: Stop[] = [];
  for (const day of plan.itinerary.days) {
    let order = 0;
    for (const a of day.activities) {
      const p = a.placeId ? plan.places[a.placeId] : undefined;
      if (a.kind !== "visit" || !p) continue;
      order += 1;
      out.push({ dayIndex: day.index, order, id: p.id, name: opts.placeName(p.id), local: p.nameLocal, lat: p.lat, lng: p.lng, start: a.startMin });
    }
  }
  return out;
}

export function buildGpx(plan: GuestPlan, opts: Options): string {
  const all = stops(plan, opts);
  const wpts = all
    .map(
      (s) =>
        `  <wpt lat="${s.lat.toFixed(6)}" lon="${s.lng.toFixed(6)}">\n    <name>${xmlEscape(`${s.dayIndex + 1}.${s.order} ${s.name}`)}</name>\n    <desc>${xmlEscape(`${opts.dayLabel(s.dayIndex)} · ${s.local}`)}</desc>\n  </wpt>`,
    )
    .join("\n");
  const trks = plan.itinerary.days
    .map((day) => {
      const pts = all.filter((s) => s.dayIndex === day.index);
      if (pts.length === 0) return "";
      const segs = pts.map((s) => `      <trkpt lat="${s.lat.toFixed(6)}" lon="${s.lng.toFixed(6)}"><name>${xmlEscape(s.name)}</name></trkpt>`).join("\n");
      return `  <trk>\n    <name>${xmlEscape(opts.dayLabel(day.index))}</name>\n    <trkseg>\n${segs}\n    </trkseg>\n  </trk>`;
    })
    .filter(Boolean)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Triplan" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${xmlEscape(opts.title)}</name></metadata>\n${wpts}\n${trks}\n</gpx>\n`;
}

export function buildKml(plan: GuestPlan, opts: Options): string {
  const all = stops(plan, opts);
  const folders = plan.itinerary.days
    .map((day) => {
      const pts = all.filter((s) => s.dayIndex === day.index);
      if (pts.length === 0) return "";
      const marks = pts
        .map(
          (s) =>
            `      <Placemark>\n        <name>${xmlEscape(`${s.order}. ${s.name}`)}</name>\n        <description>${xmlEscape(s.local)}</description>\n        <Point><coordinates>${s.lng.toFixed(6)},${s.lat.toFixed(6)},0</coordinates></Point>\n      </Placemark>`,
        )
        .join("\n");
      const line = `      <Placemark>\n        <name>${xmlEscape(opts.dayLabel(day.index))}</name>\n        <LineString><tessellate>1</tessellate><coordinates>${pts.map((s) => `${s.lng.toFixed(6)},${s.lat.toFixed(6)},0`).join(" ")}</coordinates></LineString>\n      </Placemark>`;
      return `    <Folder>\n      <name>${xmlEscape(opts.dayLabel(day.index))}</name>\n${marks}\n${line}\n    </Folder>`;
    })
    .filter(Boolean)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>${xmlEscape(opts.title)}</name>\n${folders}\n  </Document>\n</kml>\n`;
}
