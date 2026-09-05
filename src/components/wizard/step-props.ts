import type { TripPreferences } from "@/lib/planner/types";
import type { Locale } from "@/lib/i18n/locales";
import type { CityLite, CountryLite } from "@/lib/data/countries-lite";
import type { WizardError } from "@/lib/wizard/validate";
import type { SeasonalItem } from "@/lib/data/seasonal";

/** Static data every step may need, computed on the server once per locale. */
export type WizardContext = {
  locale: Locale;
  countries: CountryLite[];
  cities: Record<string, CityLite[]>;
  /** Plug types by country code, where known (packing list). */
  plugTypesByCountry?: Record<string, string[]>;
  /** Curated seasonal highlights (festivals, blossoms, crowd warnings) for the dates step. */
  seasonal?: SeasonalItem[];
};

export type StepProps = {
  prefs: TripPreferences;
  set: <K extends keyof TripPreferences>(key: K, value: TripPreferences[K]) => void;
  update: (patch: Partial<TripPreferences>) => void;
  ctx: WizardContext;
  errors: WizardError[];
};
