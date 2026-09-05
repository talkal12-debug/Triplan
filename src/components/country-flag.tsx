import { cn } from "@/lib/utils";

type Props = {
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** Rendered height in px; the box is 4:3 and the flag is letterboxed inside it. */
  size?: 20 | 24 | 32 | 40 | 48;
  className?: string;
};

/**
 * Flag image served from public/flags (downloaded once from flagcdn.com by
 * `npm run data:flags`). Emoji flags are not rendered on Windows, so an image
 * is the only way to show one everywhere; self-hosting keeps it offline-safe
 * and free of third-party requests.
 * The 4:3 box has a fixed size, so flags of any ratio never shift the layout
 * while they load. Decorative: the country name is always written next to it.
 */
export function CountryFlag({ code, size = 24, className }: Props) {
  const cc = code.toLowerCase();
  const width = Math.round((size * 4) / 3);
  return (
    <span className={cn("inline-block shrink-0", className)} style={{ width, height: size }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static image, no optimisation needed */}
      <img
        src={`/flags/h24/${cc}.png`}
        srcSet={`/flags/h24/${cc}.png 1x, /flags/h48/${cc}.png 2x`}
        width={width}
        height={size}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-full rounded-sm object-contain drop-shadow-xs"
      />
    </span>
  );
}
