import { ExperienceGridSkeleton } from "@/components/experiences/experience-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExperiencesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-6 pt-14 pb-24 lg:px-10">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-8 h-14 w-full max-w-xl" />
      <Skeleton className="mt-4 h-6 w-full max-w-2xl" />
      <div className="mt-12 grid gap-10 lg:grid-cols-[17rem_1fr]">
        <Skeleton className="hidden h-[32rem] rounded-2xl lg:block" />
        <div>
          <Skeleton className="h-11 w-full rounded-lg" />
          <ExperienceGridSkeleton count={4} className="mt-8 md:grid-cols-2 lg:grid-cols-2" />
        </div>
      </div>
    </div>
  );
}
