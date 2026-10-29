import { FlaskConical } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Banner for anything that looks functional but isn't connected yet. */
export function PreviewNotice({
  title = "Preview",
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Alert variant="preview" className={className}>
      <FlaskConical aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-forest-800/80">{children}</AlertDescription>
    </Alert>
  );
}

/** Inline label for a non-functional action or sample data. */
export function PreviewBadge({ children = "Preview", className }: { children?: React.ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-gold-500/50 bg-gold-200/50 text-gold-700", className)}>
      <FlaskConical aria-hidden="true" />
      {children}
    </Badge>
  );
}
