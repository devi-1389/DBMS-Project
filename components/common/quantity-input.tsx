"use client";

import { useId } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuantityInput({
  label,
  value,
  min,
  max,
  onChange,
  unit = "guest",
  description,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  unit?: string;
  description?: string;
  className?: string;
}) {
  const id = useId();
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div>
        <p id={`${id}-label`} className="text-sm font-semibold">
          {label}
        </p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div role="group" aria-labelledby={`${id}-label`} className="flex items-center gap-1 rounded-full border bg-card p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          aria-label={`Fewer ${unit}s`}
        >
          <Minus />
        </Button>
        <output aria-live="polite" className="w-10 text-center text-sm font-semibold tabular-nums">
          {value}
          <span className="sr-only"> {value === 1 ? unit : `${unit}s`}</span>
        </output>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          aria-label={`More ${unit}s`}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
