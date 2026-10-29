import { Skeleton } from "@/components/ui/skeleton";

export default function ExperienceLoading() {
  return (
    <div className="mx-auto max-w-7xl px-6 pt-10 pb-24 lg:px-10" role="status" aria-label="Loading experience">
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-6 aspect-[4/3] w-full rounded-3xl sm:aspect-[21/9]" />
      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_24rem] lg:gap-16">
        <div className="space-y-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-14 w-3/4" />
          <Skeleton className="h-7 w-full max-w-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-[28rem] rounded-3xl" />
      </div>
    </div>
  );
}
