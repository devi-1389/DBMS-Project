import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/** Pill-shaped toggle for multi-select options (aria-pressed). */
export function ToggleChip({
  pressed,
  onPressedChange,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onClick"> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 [&_svg]:size-4",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-forest-800/20 bg-card hover:border-forest-800/40 hover:bg-secondary",
        className,
      )}
      {...props}
    >
      {pressed && <Check aria-hidden="true" />}
      {children}
    </button>
  );
}
