import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/types/booking";
import { cn } from "@/lib/utils";

const STYLES: Record<BookingStatus, { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "border-transparent bg-forest-700 text-ivory-50" },
  pending: { label: "Pending", className: "border-gold-500/60 bg-gold-200/60 text-gold-700" },
  completed: { label: "Completed", className: "border-transparent bg-secondary text-secondary-foreground" },
  cancelled: { label: "Cancelled", className: "border-destructive/30 bg-transparent text-destructive" },
  no_show: { label: "No-show", className: "border-border bg-muted text-muted-foreground" },
};

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const style = STYLES[status];
  return (
    <Badge variant="outline" className={cn(style.className, className)}>
      {style.label}
    </Badge>
  );
}
