"use client";

import { Check, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Large tappable card used for single-choice questions. */
export function OptionCard({
  selected,
  onSelect,
  title,
  body,
  icon,
  name,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  body?: string;
  icon?: React.ReactNode;
  name: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-card p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" />
      {icon && (
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {body && <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border-2",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
      >
        {selected && <Check className="size-4" />}
      </span>
    </label>
  );
}

/** Multi-select chip. */
export function Chip({
  selected,
  onToggle,
  children,
  icon,
  disabled,
  ariaLabel,
}: {
  selected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** Number input with big +/- buttons (touch friendly). */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
  label,
  hint,
  increaseLabel,
  decreaseLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  hint?: string;
  increaseLabel: string;
  decreaseLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-4">
      <div>
        <div className="font-medium">{label}</div>
        {hint && <div className="text-sm text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={decreaseLabel}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid size-11 place-items-center rounded-full border bg-background transition-colors hover:bg-muted disabled:opacity-40 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Minus className="size-5" aria-hidden />
        </button>
        <output className="w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
          {value}
        </output>
        <button
          type="button"
          aria-label={increaseLabel}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid size-11 place-items-center rounded-full border bg-background transition-colors hover:bg-muted disabled:opacity-40 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Labelled switch row. */
export function SwitchRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-2xl border bg-card px-4 py-3">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted-foreground">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "start-6" : "start-1",
          )}
        />
      </span>
    </label>
  );
}

export function FieldLabel({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <div className="mb-2">
      <label htmlFor={htmlFor} className="font-medium">
        {children}
      </label>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "h-12 w-full rounded-xl border border-input bg-card px-4 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
