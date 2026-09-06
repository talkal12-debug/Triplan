import "server-only";
import type { ZodType } from "zod";
import { fetchJson } from "./http";

/**
 * One place for Overpass requests. The public instances are volunteer-run and
 * often slow, overloaded (504) or unreachable from a given network, so every
 * query is sent to all of them at once and the first good answer wins.
 * OVERPASS_URL (env) is tried too, first in the list.
 */
export const OVERPASS_URLS = [
  ...(process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : []),
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];

export async function overpassQuery<T>(query: string, opts: { provider: string; schema: ZodType<T>; cacheKey: string; ttlMs: number; timeoutMs: number }): Promise<T> {
  return Promise.any(
    [...new Set(OVERPASS_URLS)].map((url) =>
      fetchJson(url, {
        provider: opts.provider,
        schema: opts.schema,
        timeoutMs: opts.timeoutMs,
        cacheKey: `${opts.cacheKey}:${url}`,
        ttlMs: opts.ttlMs,
        init: { method: "POST", body: `data=${encodeURIComponent(query)}`, headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      }),
    ),
  ).catch((err: unknown) => {
    // Say what actually went wrong on each instance (the note ends up in the plan's diagnostics).
    const details = err instanceof AggregateError ? err.errors.map((e) => (e instanceof Error ? `${e.message}${e.cause instanceof Error ? ` (${e.cause.message})` : ""}` : String(e))) : [String(err)];
    throw new Error(`${opts.provider}: all Overpass instances failed: ${[...new Set(details)].join("; ")}`);
  });
}
