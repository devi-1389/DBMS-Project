"use client";

import { useState, useTransition } from "react";
import { CalendarX2, Save } from "lucide-react";

import { cancelBookingAction, changeBookingGuestsAction } from "@/app/actions/bookings";
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

type Feedback = { ok: boolean; message?: string };

/** Change guests or cancel. The server re-checks ownership, the 24-hour window, seats and equipment. */
export function ManageBooking({
  reference,
  title,
  partySize,
  maxPartySize,
  canChangeGuests,
  canCancel,
  deadline,
}: {
  reference: string;
  title: string;
  partySize: number;
  maxPartySize: number;
  canChangeGuests: boolean;
  canCancel: boolean;
  /** "Wed 4 Nov, 7:00 am": when online changes close. */
  deadline: string;
}) {
  const [guests, setGuests] = useState(partySize);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<Feedback>) =>
    startTransition(async () => {
      setFeedback(await action());
    });

  return (
    <section aria-labelledby="manage-title" className="rounded-2xl border bg-card p-6">
      <h2 id="manage-title" className="font-display text-2xl font-semibold">
        Change or cancel
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {canChangeGuests || canCancel
          ? `Free changes and cancellation online until ${deadline}.`
          : "Online changes have closed for this booking. Please contact the resort team."}
      </p>

      {canChangeGuests && (
        <div className="mt-5 flex flex-wrap items-end gap-4">
          <QuantityInput
            label="Guests"
            description={`Up to ${maxPartySize} for this session`}
            value={guests}
            min={1}
            max={maxPartySize}
            onChange={(value) => {
              setGuests(value);
              setFeedback(null);
            }}
          />
          <Button
            variant="outline"
            disabled={pending || guests === partySize}
            onClick={() => run(() => changeBookingGuestsAction({ reference, partySize: guests }))}
          >
            <Save />
            {pending ? "Saving…" : "Save guests"}
          </Button>
        </div>
      )}

      {canCancel && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="mt-5 text-destructive hover:text-destructive" disabled={pending}>
              <CalendarX2 />
              Cancel booking
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Cancel {reference}?</DialogTitle>
              <DialogDescription>
                {title}. The places are released for other guests and nothing is charged. This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Keep booking</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="destructive" onClick={() => run(() => cancelBookingAction(reference))}>
                  Cancel booking
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {feedback?.message && (
        <p role={feedback.ok ? "status" : "alert"} className={feedback.ok ? "mt-4 text-sm text-forest-700" : "mt-4 text-sm text-destructive"}>
          {feedback.message}
        </p>
      )}
    </section>
  );
}
