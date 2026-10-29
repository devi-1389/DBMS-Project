"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarCheck, CircleCheck, Ticket } from "lucide-react";

import { createBookingAction } from "@/app/actions/bookings";
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
import { BOOKING_POLICY } from "@/lib/bookings";
import { formatAmount, formatDate, formatTimeRange } from "@/lib/format";
import { bookingHref, ROUTES } from "@/lib/navigation";

type Outcome = { ok: true; reference: string; message?: string } | { ok: false; code: string; message: string };

/**
 * Confirms and books one session. The idempotency key is made when the dialog opens, so
 * a double click or a retried request can't create a second booking. The server sets the
 * price and checks seats, guides and equipment again.
 */
export function BookSessionDialog({
  slotId,
  title,
  startsAt,
  endsAt,
  partySize,
  unitPriceMinor,
  currency,
  returnTo,
  disabled,
  label = "Book now",
  size = "lg",
  variant = "default",
  className,
}: {
  slotId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  partySize: number;
  unitPriceMinor: number;
  currency: string;
  /** Where to come back to after signing in. */
  returnTo: string;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      const result = await createBookingAction({ slotId, partySize, idempotencyKey });
      setOutcome(result.ok ? { ok: true, reference: result.data.reference, message: result.message } : result);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setIdempotencyKey(crypto.randomUUID());
          setOutcome(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size={size} variant={variant} disabled={disabled} className={className}>
          <CalendarCheck />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {outcome?.ok ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-2xl">
                <CircleCheck className="size-6 text-forest-700" aria-hidden="true" />
                You&apos;re booked
              </DialogTitle>
              <DialogDescription>{outcome.message}</DialogDescription>
            </DialogHeader>
            <p className="rounded-xl bg-secondary px-4 py-3 text-center font-mono text-lg font-semibold">{outcome.reference}</p>
            <DialogFooter>
              <Button asChild variant="outline">
                <Link href={ROUTES.myBookings}>All my bookings</Link>
              </Button>
              <Button asChild>
                <Link href={bookingHref(outcome.reference)}>
                  <Ticket />
                  View booking
                </Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Confirm your booking</DialogTitle>
              <DialogDescription>Check the details, then confirm. You pay at the resort.</DialogDescription>
            </DialogHeader>
            <dl className="divide-y rounded-xl border text-sm">
              {[
                ["Experience", title],
                ["When", `${formatDate(startsAt)} · ${formatTimeRange(startsAt, endsAt)} (resort time)`],
                ["Guests", String(partySize)],
                ["Total", formatAmount(unitPriceMinor * partySize, currency)],
                ["Payment", "Pay at the resort"],
              ].map(([term, value]) => (
                <div key={term} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-muted-foreground">{term}</dt>
                  <dd className="text-right font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              Free cancellation and guest changes online until {BOOKING_POLICY.changeHours} hours before the start.
            </p>
            {outcome && !outcome.ok && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {outcome.message}
                {outcome.code === "unauthenticated" && (
                  <>
                    {" "}
                    <Link
                      href={`${ROUTES.login}?redirect_url=${encodeURIComponent(returnTo)}`}
                      className="font-semibold underline underline-offset-4"
                    >
                      Sign in
                    </Link>
                  </>
                )}
              </p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Not now</Button>
              </DialogClose>
              <Button onClick={confirm} disabled={pending}>
                {pending ? "Booking…" : "Confirm booking"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
