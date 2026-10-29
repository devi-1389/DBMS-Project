import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 pt-8 pb-24 lg:px-10" role="status" aria-label="Loading admin console">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-11 w-96 max-w-full rounded-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
