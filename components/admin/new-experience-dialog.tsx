"use client";

import { useState } from "react";
import { CircleCheck, Plus } from "lucide-react";

import { FormField } from "@/components/common/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_LABELS, EXPERIENCE_CATEGORIES } from "@/lib/categories";
import { DIFFICULTIES, DIFFICULTY_LABELS } from "@/lib/difficulty";
import {
  EMPTY_EXPERIENCE_FORM,
  validateExperienceForm,
  type ExperienceFormValues,
  type FieldErrors,
} from "@/lib/validation/forms";

export function NewExperienceDialog() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY_EXPERIENCE_FORM);
  const [errors, setErrors] = useState<FieldErrors<keyof ExperienceFormValues>>({});
  const [checked, setChecked] = useState(false);

  const set = (field: keyof ExperienceFormValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setChecked(false);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateExperienceForm(values);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`new-exp-${first}`)?.focus();
      setChecked(false);
      return;
    }
    setChecked(true);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setValues(EMPTY_EXPERIENCE_FORM);
      setErrors({});
      setChecked(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New experience
        </Button>
      </DialogTrigger>
      <DialogContent className="block max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New experience</DialogTitle>
          <DialogDescription>
            The form checks your input, but saving isn&apos;t connected yet. Nothing is created.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="mt-6 grid gap-5 sm:grid-cols-2">
          <FormField id="new-exp-title" label="Title" error={errors.title} className="sm:col-span-2">
            {(field) => <Input {...field} value={values.title} onChange={set("title")} placeholder="e.g. Moonlit Lake Paddle" />}
          </FormField>
          <FormField id="new-exp-category" label="Category" error={errors.category}>
            {(field) => (
              <NativeSelect {...field} value={values.category} onChange={set("category")}>
                <option value="">Choose…</option>
                {EXPERIENCE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="new-exp-difficulty" label="Difficulty" error={errors.difficulty}>
            {(field) => (
              <NativeSelect {...field} value={values.difficulty} onChange={set("difficulty")}>
                <option value="">Choose…</option>
                {DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {DIFFICULTY_LABELS[difficulty]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="new-exp-durationMinutes" label="Duration (minutes)" error={errors.durationMinutes}>
            {(field) => (
              <Input {...field} type="number" inputMode="numeric" min={30} max={720} step={15} value={values.durationMinutes} onChange={set("durationMinutes")} />
            )}
          </FormField>
          <FormField id="new-exp-capacity" label="Capacity per session" error={errors.capacity}>
            {(field) => (
              <Input {...field} type="number" inputMode="numeric" min={1} max={40} value={values.capacity} onChange={set("capacity")} />
            )}
          </FormField>
          <FormField id="new-exp-price" label="Price per guest (USD)" hint="Use 0 for complimentary." error={errors.price}>
            {(field) => (
              <Input {...field} type="number" inputMode="decimal" min={0} step={5} value={values.price} onChange={set("price")} />
            )}
          </FormField>
          <FormField
            id="new-exp-summary"
            label="Summary"
            hint={`${values.summary.trim().length} / 160 characters`}
            error={errors.summary}
            className="sm:col-span-2"
          >
            {(field) => <Textarea {...field} value={values.summary} onChange={set("summary")} rows={3} />}
          </FormField>

          {checked && (
            <Alert variant="success" className="sm:col-span-2">
              <CircleCheck aria-hidden="true" />
              <AlertTitle>Everything looks valid</AlertTitle>
              <AlertDescription>
                Saving arrives with the database (Phase 7), so this experience was not created.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="sm:col-span-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
            <Button type="submit">Check details</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
