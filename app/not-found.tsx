import Link from "next/link";
import { Compass } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/navigation";

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="text-forest-900">
        <Logo />
      </div>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        className="mt-16 w-full max-w-xl"
      >
        <Button asChild>
          <Link href={ROUTES.home}>Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={ROUTES.experiences}>Browse experiences</Link>
        </Button>
      </EmptyState>
    </main>
  );
}
