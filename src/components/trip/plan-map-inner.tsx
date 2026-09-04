"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GuestPlan } from "@/lib/guest/trips";
import type { Locale } from "@/lib/i18n/locales";
import { placeLabel } from "@/lib/guest/plan-helpers";

type Props = {
  plan: GuestPlan;
  dayIndex: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/fiord";

// The tile-parsing worker is served as a static file (copied on install) so it loads
// the same way under Turbopack, webpack and the service worker.
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

/** MapLibre map of one day's route. Loaded lazily (see plan-map.tsx). */
export function PlanMapInner({ plan, dayIndex, selectedId, onSelect }: Props) {
  const t = useTranslations("plan");
  const locale = useLocale() as Locale;
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Start on the right area even before the style has loaded (e.g. in a background tab).
    const day = plan.itinerary.days[dayIndex];
    const stay = plan.itinerary.stays.find((s) => s.id === day?.stayId);
    const initial: [number, number][] = [];
    if (stay) initial.push([stay.center.lng, stay.center.lat]);
    for (const a of day?.activities ?? []) {
      const p = a.placeId ? plan.places[a.placeId] : undefined;
      if (p) initial.push([p.lng, p.lat]);
    }
    const bounds = initial.length ? initial.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(initial[0], initial[0])) : undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolvedTheme === "dark" ? STYLE_DARK : STYLE_LIGHT,
      ...(bounds ? { bounds, fitBoundsOptions: { padding: 48, maxZoom: 15 } } : { center: [0, 0], zoom: 2 }),
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.on("error", (e) => console.error("[map]", e.error?.message ?? e));
    if (process.env.NODE_ENV === "development") {
      (window as unknown as { __triplanMap?: maplibregl.Map }).__triplanMap = map;
    }
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch style with the theme.
  useEffect(() => {
    mapRef.current?.setStyle(resolvedTheme === "dark" ? STYLE_DARK : STYLE_LIGHT);
  }, [resolvedTheme]);

  // Draw the selected day.
  useEffect(() => {
    const map = mapRef.current;
    const day = plan.itinerary.days[dayIndex];
    if (!map || !day) return;

    const stay = plan.itinerary.stays.find((s) => s.id === day.stayId);
    const visits = day.activities.filter((a) => a.kind === "visit" && a.placeId && plan.places[a.placeId]);
    const points = visits.map((a) => ({ id: a.id, place: plan.places[a.placeId!] }));

    const draw = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      const routeId = "triplan-route";
      if (map.getLayer(routeId)) map.removeLayer(routeId);
      if (map.getSource(routeId)) map.removeSource(routeId);

      const coords: [number, number][] = [];
      if (stay) coords.push([stay.center.lng, stay.center.lat]);
      for (const p of points) coords.push([p.place.lng, p.place.lat]);
      if (coords.length >= 2) {
        map.addSource(routeId, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } });
        map.addLayer({
          id: routeId,
          type: "line",
          source: routeId,
          paint: { "line-color": "#2a8fa3", "line-width": 3, "line-dasharray": [2, 1.5], "line-opacity": 0.85 },
        });
      }

      if (stay) {
        const el = document.createElement("div");
        el.className = "grid size-8 place-items-center rounded-full border-2 border-white bg-sunset text-sunset-foreground shadow";
        el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/></svg>';
        el.setAttribute("aria-label", t("map.hotel"));
        markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([stay.center.lng, stay.center.lat]).addTo(map));
      }

      points.forEach((p, i) => {
        const el = document.createElement("button");
        el.type = "button";
        const active = p.id === selectedId;
        el.className = `grid size-8 place-items-center rounded-full border-2 border-white text-sm font-semibold shadow transition-transform ${active ? "scale-125 bg-sunset text-sunset-foreground" : "bg-primary text-primary-foreground"}`;
        el.textContent = String(i + 1);
        el.setAttribute("aria-label", placeLabel(p.place, locale));
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(p.id === selectedId ? null : p.id);
        });
        const popup = new maplibregl.Popup({ offset: 18, closeButton: false }).setText(placeLabel(p.place, locale));
        markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([p.place.lng, p.place.lat]).setPopup(popup).addTo(map));
      });

      if (coords.length >= 2) {
        const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
        map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
      } else if (coords.length === 1) {
        map.jumpTo({ center: coords[0], zoom: 13 });
      }
    };

    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);
    map.on("style.load", draw);
    return () => {
      map.off("style.load", draw);
    };
  }, [plan, dayIndex, selectedId, locale, t]);

  // Fly to the selected marker.
  useEffect(() => {
    const map = mapRef.current;
    const day = plan.itinerary.days[dayIndex];
    const a = day?.activities.find((x) => x.id === selectedId);
    const place = a?.placeId ? plan.places[a.placeId] : undefined;
    if (map && place) map.easeTo({ center: [place.lng, place.lat], duration: 300 });
  }, [selectedId, plan, dayIndex]);

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[60vh] min-h-80 w-full overflow-hidden rounded-2xl border" role="region" aria-label={t("map.showing", { n: dayIndex + 1 })} />
      <p className="mt-2 text-xs text-muted-foreground">{t("map.legend")}</p>
    </div>
  );
}
