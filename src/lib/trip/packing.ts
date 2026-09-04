import type { TripPreferences } from "@/lib/planner/types";
import type { PlanExtras } from "@/lib/guest/trips";

/**
 * Packing list from facts we actually have: temperatures/rain (weather), effort,
 * who travels, transport, accessibility, plug type. Item ids map to messages;
 * `note` carries a parameter (e.g. plug types).
 */
export type PackingItem = { id: string; group: "documents" | "clothing" | "gear" | "kids" | "health" | "tech"; note?: string };

type Facts = {
  prefs: TripPreferences;
  weather?: PlanExtras["weather"];
  plugTypes?: string[];
  drivingSide?: "left" | "right";
  homePlugTypes?: string[];
};

export function buildPackingList({ prefs, weather, plugTypes, homePlugTypes = ["C", "H"] }: Facts): PackingItem[] {
  const items: PackingItem[] = [];
  const add = (id: string, group: PackingItem["group"], note?: string) => {
    if (!items.some((i) => i.id === id)) items.push({ id, group, note });
  };

  add("passport", "documents");
  add("insurance", "documents");
  add("bookings", "documents");
  add("cards_cash", "documents");
  if (prefs.transport.car > 0) add("driving_licence", "documents");

  const temps = Object.values(weather ?? {}).map((w) => w.tempMax).filter((t): t is number => t !== null);
  const lows = Object.values(weather ?? {}).map((w) => w.tempMin).filter((t): t is number => t !== null);
  const rainy = Object.values(weather ?? {}).some((w) => w.precipProbability >= 40);
  const hot = temps.some((t) => t >= 27);
  const cold = lows.some((t) => t <= 8);
  const veryCold = lows.some((t) => t <= 0);
  if (hot) {
    add("sunscreen", "health");
    add("hat", "clothing");
    add("light_clothes", "clothing");
    add("water_bottle", "gear");
  }
  if (cold) add("warm_layers", "clothing");
  if (veryCold) add("gloves_scarf", "clothing");
  if (rainy) {
    add("rain_jacket", "clothing");
    add("umbrella", "gear");
  }
  if (temps.length === 0) add("check_weather", "clothing");

  if (prefs.effort === "high") add("hiking_shoes", "clothing");
  else add("walking_shoes", "clothing");
  if (prefs.effort !== "low") add("daypack", "gear");
  if (prefs.interests.includes("beaches")) add("swimwear", "clothing");
  if (prefs.interests.includes("adventure")) add("sports_clothes", "clothing");
  if (prefs.interests.includes("religion")) add("modest_clothes", "clothing");
  if (prefs.interests.includes("photography")) add("camera_gear", "tech");

  if (prefs.party.infants > 0) {
    add("diapers", "kids");
    add("baby_food", "kids");
    add("carrier", "kids");
    if (prefs.party.stroller) add("stroller_travel", "kids");
  }
  if (prefs.party.childrenAges.length > 0) {
    add("kids_snacks", "kids");
    add("kids_entertainment", "kids");
  }
  if (prefs.party.seniors > 0 || prefs.accessibility.length > 0) add("medications", "health");
  add("first_aid", "health");
  if (prefs.accessibility.includes("altitude")) add("altitude_meds", "health");

  add("phone_charger", "tech");
  add("power_bank", "tech");
  if (plugTypes && plugTypes.length && !plugTypes.some((p) => homePlugTypes.includes(p))) {
    add("plug_adapter", "tech", plugTypes.join(" / "));
  }
  add("esim", "tech");
  add("offline_maps", "tech");
  return items;
}
