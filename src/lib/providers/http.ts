import "server-only";
import type { ZodType } from "zod";

/**
 * Small fetch helper for external providers: timeout, identifying User-Agent,
 * Zod validation of the response and an in-memory TTL cache (per server process).
 * Every provider call must go through here so failures are uniform and logged.
 */
export const USER_AGENT = "Triplan/0.1 (https://triplan.app; talkal12@gmail.com)";

const cache = new Map<string, { expires: number; value: unknown }>();

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly status?: number,
  ) {
    super(`${provider}: ${message}`);
    this.name = "ProviderError";
  }
}

export type FetchJsonOptions<T> = {
  provider: string;
  schema: ZodType<T>;
  init?: RequestInit;
  timeoutMs?: number;
  /** Cache key; omit to skip caching. */
  cacheKey?: string;
  ttlMs?: number;
};

export async function fetchJson<T>(url: string, opts: FetchJsonOptions<T>): Promise<T> {
  const key = opts.cacheKey;
  if (key) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(url, {
      ...opts.init,
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...(opts.init?.headers ?? {}) },
    });
    if (!res.ok) throw new ProviderError(opts.provider, `HTTP ${res.status}`, res.status);
    const json: unknown = await res.json();
    const parsed = opts.schema.safeParse(json);
    if (!parsed.success) throw new ProviderError(opts.provider, `unexpected response shape: ${parsed.error.issues[0]?.message ?? "?"}`);
    if (key) cache.set(key, { expires: Date.now() + (opts.ttlMs ?? 60 * 60 * 1000), value: parsed.data });
    return parsed.data;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    throw new ProviderError(opts.provider, err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

/** Run a provider call; on any failure return the fallback and remember why. */
export async function tryProvider<T>(label: string, call: () => Promise<T>, fallback: T, notes?: string[]): Promise<T> {
  try {
    return await call();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[providers] ${label} failed, using fallback: ${message}`);
    notes?.push(`${label}: ${message}`);
    return fallback;
  }
}

export function clearProviderCache() {
  cache.clear();
}
