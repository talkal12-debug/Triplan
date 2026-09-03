import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Seconds. */
  delay?: number;
};

/**
 * Subtle rise-and-fade on mount, done in CSS so content is visible even before
 * JavaScript hydrates. prefers-reduced-motion is handled globally in globals.css.
 */
export function FadeIn({ children, className, delay = 0 }: Props) {
  return (
    <div
      className={cn(
        "animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both duration-500 ease-out",
        className,
      )}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
