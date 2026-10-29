"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Shared error boundary UI. Server errors arrive with a generic message and a digest
 * that matches the server log, so nothing sensitive is shown here.
 */
export function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <EmptyState
      icon={TriangleAlert}
      title="We couldn't load this page"
      description={`Something went wrong on our side. Please try again.${digest ? ` (Reference ${digest})` : ""}`}
    >
      <Button onClick={() => retry()}>Try again</Button>
    </EmptyState>
  );
}
