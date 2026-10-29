import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** Styled native <select>. `className` sizes the wrapper; the select fills it. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div data-slot="native-select-wrapper" className={cn("relative", className)}>
      <select
        data-slot="native-select"
        className="h-10 w-full appearance-none rounded-lg border border-input bg-card pr-9 pl-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}

export { NativeSelect };
