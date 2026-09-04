import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Seconds. */
  delay?: number;
  /** Render as a list item when the parent is a <ul>/<ol>, so the list stays valid. */
  as?: "div" | "li";
};

/**
 * Subtle rise-and-fade on mount, done in CSS so content is visible even before
 * JavaScript hydrates. prefers-reduced-motion is handled globally in globals.css.
 */
export function FadeIn({ children, className, delay = 0, as: Tag = "div" }: Props) {
  return (
    <Tag
      className={cn(
        "animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both duration-500 ease-out",
        className,
      )}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </Tag>
  );
}
