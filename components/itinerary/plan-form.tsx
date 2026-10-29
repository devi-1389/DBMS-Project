"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Plus } from "lucide-react";

import { createPlanAction, updatePlanAction } from "@/app/actions/itinerary";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/navigation";
import { planSchema, toFieldErrors } from "@/lib/validation/schemas";

type PlanValues = { name: string; arrival: string; departure: string; budget: string };
type PlanSubmit = { name: string; arrival: string | null; departure: string | null; activityBudgetMinor: number | null };

/** "15,000" or "₹15000" → 1500000 paise; blank → no budget. */
function budgetToMinor(value: string) {
  const cleaned = value.replace(/[₹,\s]/g, "");
  if (!cleaned) return null;
  return Math.round(Number(cleaned) * 100);
}

function PlanFields({
  idPrefix,
  initial,
  submitLabel,
  onSubmit,
}: {
  idPrefix: string;
  initial: PlanValues;
  submitLabel: string;
  onSubmit: (input: PlanSubmit) => Promise<{ ok: boolean; message?: string; fieldErrors?: Record<string, string> }>;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input = {
      name: values.name,
      arrival: values.arrival || null,
      departure: values.departure || null,
      activityBudgetMinor: budgetToMinor(values.budget),
    };
    const parsed = planSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error).fieldErrors);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await onSubmit(parsed.data);
      setErrors(result.fieldErrors ?? {});
      if (result.message) setMessage({ ok: result.ok, text: result.message });
    });
  };

  const field = (key: keyof PlanValues) => ({
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <form onSubmit={submit} noValidate className="@container">
      <div className="grid gap-4 @lg:grid-cols-2 @4xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto] @4xl:items-start">
        <FormField id={`${idPrefix}-name`} label="Plan name" error={errors.name}>
          {(props) => <Input {...props} {...field("name")} maxLength={80} />}
        </FormField>
        <FormField id={`${idPrefix}-arrival`} label="Arrival" error={errors.arrival}>
          {(props) => <Input {...props} {...field("arrival")} type="date" />}
        </FormField>
        <FormField id={`${idPrefix}-departure`} label="Departure" error={errors.departure}>
          {(props) => <Input {...props} {...field("departure")} type="date" />}
        </FormField>
        <FormField
          id={`${idPrefix}-budget`}
          label="Activity budget (₹)"
          hint="For everyone in the plan. Optional."
          error={errors.activityBudgetMinor}
        >
          {(props) => <Input {...props} {...field("budget")} inputMode="numeric" placeholder="e.g. 15,000" />}
        </FormField>
        <div className="grid gap-2 @4xl:pt-6">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={message.ok ? "col-span-full text-sm text-forest-700" : "col-span-full text-sm text-destructive"}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

export function EditPlanForm({
  plan,
}: {
  plan: { id: string; name: string; arrival: string | null; departure: string | null; activityBudgetMinor: number | null };
}) {
  return (
    <PlanFields
      key={plan.id}
      idPrefix="edit-plan"
      initial={{
        name: plan.name,
        arrival: plan.arrival ?? "",
        departure: plan.departure ?? "",
        budget: plan.activityBudgetMinor === null ? "" : String(plan.activityBudgetMinor / 100),
      }}
      submitLabel="Save plan"
      onSubmit={(input) => updatePlanAction(plan.id, input)}
    />
  );
}

export function CreatePlanDialog({ hasPlans }: { hasPlans: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={hasPlans ? "outline" : "default"}>
          <Plus />
          New plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <CalendarRange className="size-5 text-gold-600" aria-hidden="true" />
            New plan
          </DialogTitle>
          <DialogDescription>Plans are saved to your account. They don&apos;t reserve anything.</DialogDescription>
        </DialogHeader>
        <PlanFields
          idPrefix="new-plan"
          initial={{ name: "My stay", arrival: "", departure: "", budget: "" }}
          submitLabel="Create plan"
          onSubmit={async (input) => {
            const result = await createPlanAction(input);
            if (result.ok) {
              setOpen(false);
              router.push(`${ROUTES.itinerary}?plan=${result.data.planId}`);
            }
            return result;
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
