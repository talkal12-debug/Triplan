/**
 * Photos come from Wikipedia (the article's lead image, hosted on Wikimedia
 * Commons, free licences). Nothing is uploaded or generated. The REST summary
 * gives a 320 px thumbnail whose URL encodes the width, so any size can be
 * asked for by rewriting it; the article page is the credit link.
 */
export type WikiImage = { url: string; page: string | null };

/** Widths Wikimedia renders on demand for anonymous clients; other widths answer 400 since 2025. */
export const WIKI_THUMB_WIDTHS = [250, 330, 500, 960, 1280, 1920] as const;

/** Same Commons thumbnail at the smallest rendered width that is at least `width` (URLs look like .../File.jpg/330px-File.jpg). */
export function wikiThumb(url: string, width: number): string {
  const bucket = WIKI_THUMB_WIDTHS.find((w) => w >= width) ?? WIKI_THUMB_WIDTHS[WIKI_THUMB_WIDTHS.length - 1];
  return url.replace(/\/(\d+)px-/, `/${bucket}px-`).replace(/\?utm_[^#]*$/, "");
}

/** The place's photo: the UI language's article first, then any language that has one. */
export function placeImage(place: { summary?: Record<string, { image?: WikiImage | null }> } | undefined, locale: string): WikiImage | null {
  if (!place?.summary) return null;
  const own = place.summary[locale]?.image;
  if (own) return own;
  for (const entry of Object.values(place.summary)) if (entry.image) return entry.image;
  return null;
}
