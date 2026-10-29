import { cn } from "@/lib/utils";

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  className,
}: {
  id?: string;
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={cn("reveal max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <p className={cn("eyebrow", tone === "dark" ? "text-gold-300" : "text-gold-700")}>{eyebrow}</p>
      <h2
        id={id}
        className="mt-4 font-display text-4xl leading-[1.05] font-medium text-balance sm:text-5xl lg:text-6xl"
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-5 text-lg leading-relaxed text-pretty",
            tone === "dark" ? "text-ivory-100/75" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
