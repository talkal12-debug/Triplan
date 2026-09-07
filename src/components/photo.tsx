"use client";

import { wikiThumb, type WikiImage } from "@/lib/images";
import { cn } from "@/lib/utils";

/**
 * A Wikipedia lead photo in a fixed-ratio box (no layout shift), lazy, with a
 * quiet credit link to the article. Plain <img>: the files are already sized
 * thumbnails on Wikimedia's CDN, so there is nothing for an optimizer to do.
 */
export function Photo({ image, alt, width = 640, className, credit, sizes }: { image: WikiImage; alt: string; width?: number; className?: string; credit?: string; sizes?: string }) {
  return (
    <figure className={cn("relative overflow-hidden bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Wikimedia thumbnails are pre-sized; no optimizer needed */}
      <img
        src={wikiThumb(image.url, width)}
        srcSet={[Math.round(width / 2), width, width * 2].map((w) => `${wikiThumb(image.url, w)} ${w}w`).join(", ")}
        sizes={sizes ?? `${width}px`}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
      {credit && image.page && (
        <figcaption className="absolute bottom-0 end-0 bg-black/45 px-1.5 py-0.5 text-[10px] leading-none text-white/90">
          <a href={image.page} target="_blank" rel="noopener noreferrer" className="hover:underline" onClick={(e) => e.stopPropagation()}>
            {credit}
          </a>
        </figcaption>
      )}
    </figure>
  );
}
