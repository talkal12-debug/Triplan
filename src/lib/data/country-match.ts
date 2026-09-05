/** Case-insensitive match on the UI name, the local name and the English name. Client-safe. */
export function countryMatches(c: { name: string; local: string | null; en?: string | null }, query: string): boolean {
  if (!query) return true;
  return [c.name, c.local, c.en].some((s) => s?.toLowerCase().includes(query));
}
