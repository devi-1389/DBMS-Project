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

type PlanValues = { name: string; arrival: string; departure: string };

function PlanFields({
  idPrefix,
  initial,
  submitLabel,
  onSubmit,
}: {
  idPrefix: string;
  initial: PlanValues;
  submitLabel: string;
  onSubmit: (input: { name: string; arrival: string | null; departure: string | null }) => Promise<{ ok: boolean; message?: string; fieldErrors?: Record<string, string> }>;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input = { name: values.name, arrival: values.arrival || null, departure: values.departure || null };
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
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-start">
      <FormField id={`${idPrefix}-name`} label="Plan name" error={errors.name}>
        {(props) => <Input {...props} {...field("name")} maxLength={80} />}
      </FormField>
      <FormField id={`${idPrefix}-arrival`} label="Arrival" error={errors.arrival}>
        {(props) => <Input {...props} {...field("arrival")} type="date" />}
      </FormField>
      <FormField id={`${idPrefix}-departure`} label="Departure" error={errors.departure}>
        {(props) => <Input {...props} {...field("departure")} type="date" />}
      </FormField>
      <div className="grid gap-2 sm:pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-forest-700 sm:col-span-4" : "text-sm text-destructive sm:col-span-4"}>
          {message.text}
        </p>
      )}
    </form>
  );
}

export function EditPlanForm({ plan }: { plan: { id: string; name: string; arrival: string | null; departure: string | null } }) {
  return (
    <PlanFields
      key={plan.id}
      idPrefix="edit-plan"
      initial={{ name: plan.name, arrival: plan.arrival ?? "", departure: plan.departure ?? "" }}
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
          initial={{ name: "My stay", arrival: "", departure: "" }}
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
