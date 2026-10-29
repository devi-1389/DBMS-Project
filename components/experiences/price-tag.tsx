import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PriceTag({
  amountMinor,
  currency,
  className,
}: {
  amountMinor: number;
  currency: string;
  className?: string;
}) {
  const free = amountMinor === 0;

  return (
    <p className={cn("leading-tight", className)}>
      <span className="block text-[0.7rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {free ? "Included" : "From"}
      </span>
      <span className="font-display text-2xl font-semibold">{formatPrice(amountMinor, currency)}</span>
      {!free && <span className="text-sm text-muted-foreground"> / guest</span>}
    </p>
  );
}
