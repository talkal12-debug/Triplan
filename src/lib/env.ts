import { z } from "zod";

/**
 * Server-side environment. Every key is optional: the app must run fully
 * without any of them (demo mode). Providers upgrade themselves when a key exists.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AFFILIATE_BOOKING_AID: z.string().optional(),
  AFFILIATE_GETYOURGUIDE_PARTNER_ID: z.string().optional(),
  AFFILIATE_VIATOR_PID: z.string().optional(),
  AFFILIATE_TIQETS_PARTNER: z.string().optional(),
  AFFILIATE_KLOOK_AID: z.string().optional(),
  AFFILIATE_KIWI_AFFILID: z.string().optional(),
  OSRM_BASE_URL: z.string().optional(),
  NOMINATIM_URL: z.string().optional(),
  OVERPASS_URL: z.string().optional(),
  /** Force every mock provider (no network at all). */
  TRIPLAN_OFFLINE: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) {
    cached = envSchema.parse(process.env);
  }
  return cached;
}

/** Demo mode = no paid/keyed provider is configured, or it was forced on. */
export function isDemoMode(): boolean {
  const env = getEnv();
  if (env.NEXT_PUBLIC_DEMO_MODE === "true") return true;
  if (env.NEXT_PUBLIC_DEMO_MODE === "false") return false;
  return !env.GOOGLE_PLACES_API_KEY && !env.ANTHROPIC_API_KEY;
}
