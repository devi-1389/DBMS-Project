import * as React from "react";
import { Slot as SlotPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3.5 gap-1.5 [&>svg]:pointer-events-none focus-visible:ring-ring focus-visible:ring-2 transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        accent: "border-transparent bg-accent text-accent-foreground",
        destructive: "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90",
        outline: "text-foreground [a&]:hover:bg-secondary",
        glass: "border-ivory-50/40 bg-ivory-50/90 text-forest-900 backdrop-blur-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? SlotPrimitive.Slot : "span";

  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
