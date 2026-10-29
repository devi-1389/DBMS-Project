import Link from "next/link";
import { Compass } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/navigation";

export default function ExperienceNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <EmptyState
        icon={Compass}
        title="We couldn't find that experience"
        description="It may have been renamed or is no longer offered. Browse the catalogue for something similar."
      >
        <Button asChild>
          <Link href={ROUTES.experiences}>Browse experiences</Link>
        </Button>
      </EmptyState>
    </div>
  );
}
