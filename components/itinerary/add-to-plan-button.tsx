"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarPlus, Check } from "lucide-react";

import { addToPlanAction } from "@/app/actions/itinerary";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/navigation";

/** Adds one session (by slot ID) to a plan via the Server Action, with inline feedback. */
export function AddToPlanButton({
  slotId,
  partySize,
  planId,
  label = "Add to plan",
  size = "sm",
}: {
  slotId: string;
  partySize: number;
  planId?: string;
  label?: string;
  size?: "sm" | "default";
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string; code?: string } | null>(null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        type="button"
        size={size}
        variant={result?.ok ? "secondary" : "outline"}
        disabled={pending || result?.ok}
        onClick={() =>
          startTransition(async () => {
            setResult(await addToPlanAction({ slotId, partySize, planId }));
          })
        }
      >
        {result?.ok ? <Check /> : <CalendarPlus />}
        {pending ? "Adding…" : result?.ok ? "In your plan" : label}
      </Button>
      {result?.ok && result.message && (
        <p role="status" className="max-w-56 text-right text-xs text-muted-foreground">
          {result.message}
        </p>
      )}
      {result && !result.ok && (
        <p role="alert" className="max-w-56 text-right text-xs text-destructive">
          {result.message}
          {result.code === "unauthenticated" && (
            <>
              {" "}
              <Link href={ROUTES.login} className="font-semibold underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
