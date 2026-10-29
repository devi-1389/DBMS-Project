"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "lucide-react";

import { deletePlanAction, removePlanItemAction, updatePlanItemAction } from "@/app/actions/itinerary";
import { QuantityInput } from "@/components/common/quantity-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ROUTES } from "@/lib/navigation";

export function PlanItemControls({
  itemId,
  title,
  partySize,
  maxParty,
}: {
  itemId: string;
  title: string;
  partySize: number;
  maxParty: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const result = await action();
      setError(result.ok ? null : (result.message ?? "That didn't work. Please try again."));
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2" aria-busy={pending}>
        <QuantityInput
          label="Guests"
          className="[&>div:first-child]:sr-only"
          value={partySize}
          min={1}
          max={Math.max(maxParty, partySize)}
          onChange={(value) => run(() => updatePlanItemAction({ itemId, partySize: value }))}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          onClick={() => run(() => removePlanItemAction(itemId))}
        >
          <Trash />
          <span className="sr-only">Remove {title} from this plan</span>
        </Button>
      </div>
      {error && (
        <p role="alert" className="max-w-64 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function DeletePlanButton({ planId, name }: { planId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          Delete plan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Delete “{name}”?</DialogTitle>
          <DialogDescription>
            This removes the plan and its planned sessions. Confirmed bookings stay exactly as they are.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Keep plan</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deletePlanAction(planId);
                if (result.ok) router.push(ROUTES.itinerary);
                else setError(result.message);
              })
            }
          >
            {pending ? "Deleting…" : "Delete plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
