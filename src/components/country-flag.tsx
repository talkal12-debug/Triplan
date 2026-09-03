import { cn } from "@/lib/utils";

type Props = {
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** Rendered height in px; width follows the flag's aspect ratio. */
  size?: 20 | 24 | 32 | 40 | 48;
  className?: string;
};

/**
 * Flag image from flagcdn.com (free, key-less). Emoji flags are not rendered on
 * Windows, so an image is the only way to show one everywhere.
 * Decorative: the country name is always written next to it.
 */
export function CountryFlag({ code, size = 24, className }: Props) {
  const cc = code.toLowerCase();
  const width = Math.round(size * 4 / 3);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny remote image, no optimisation needed
    <img
      src={`https://flagcdn.com/h${size <= 24 ? 24 : size <= 40 ? 40 : 60}/${cc}.png`}
      srcSet={`https://flagcdn.com/h${size <= 24 ? 24 : size <= 40 ? 40 : 60}/${cc}.png 1x, https://flagcdn.com/h${size <= 24 ? 60 : size <= 40 ? 80 : 120}/${cc}.png 2x`}
      width={width}
      height={size}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("inline-block shrink-0 rounded-sm object-cover shadow-xs ring-1 ring-black/10", className)}
      style={{ height: size, width: "auto" }}
    />
  );
}
