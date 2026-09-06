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

/** The public instances refuse connections from Vercel; without a private OVERPASS_URL there is no point waiting for them. */
export const overpassReachable = !process.env.VERCEL || Boolean(process.env.OVERPASS_URL);

export async function overpassQuery<T>(query: string, opts: { provider: string; schema: ZodType<T>; cacheKey: string; ttlMs: number; timeoutMs: number }): Promise<T> {
  if (!overpassReachable) throw new Error(`${opts.provider}: Overpass is not reachable from this host (set OVERPASS_URL to a private instance)`);
  return Promise.any(
    [...new Set(OVERPASS_URLS)].map((url) =>
      // GET with the query in the URL: Overpass accepts both, and a plain GET travels through
      // hosting proxies that were seen to stall the form POST.
      fetchJson(`${url}?data=${encodeURIComponent(query)}`, {
        provider: opts.provider,
        schema: opts.schema,
        timeoutMs: opts.timeoutMs,
        cacheKey: `${opts.cacheKey}:${url}`,
        ttlMs: opts.ttlMs,
      }),
    ),
  ).catch((err: unknown) => {
    // Say what actually went wrong on each instance (the note ends up in the plan's diagnostics).
    const details = err instanceof AggregateError ? err.errors.map((e) => (e instanceof Error ? `${e.message}${e.cause instanceof Error ? ` (${e.cause.message})` : ""}` : String(e))) : [String(err)];
    throw new Error(`${opts.provider}: all Overpass instances failed: ${[...new Set(details)].join("; ")}`);
  });
}
