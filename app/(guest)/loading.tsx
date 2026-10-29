import { Skeleton } from "@/components/ui/skeleton";

export default function GuestAreaLoading() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
