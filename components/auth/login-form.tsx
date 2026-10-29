"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, FlaskConical } from "lucide-react";

import { FormField } from "@/components/common/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/lib/navigation";
import { validateSignIn, validateSignUp, type FieldErrors } from "@/lib/validation/forms";

function focusFirstError(prefix: string, errors: Record<string, string | undefined>) {
  const first = Object.keys(errors).find((key) => errors[key]);
  if (first) document.getElementById(`${prefix}-${first}`)?.focus();
}

function PasswordInput({
  value,
  onChange,
  autoComplete,
  ...field
}: {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...field}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pr-11"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-1/2 right-1 -translate-y-1/2"
        onClick={() => setVisible((current) => !current)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}

function NotConnected() {
  return (
    <Alert variant="preview">
      <FlaskConical aria-hidden="true" />
      <AlertTitle>Sign-in isn&apos;t connected yet</AlertTitle>
      <AlertDescription className="text-forest-800/80">
        <p>
          Accounts arrive with Clerk in Phase 3. Nothing you entered was sent or stored.{" "}
          <Link href={ROUTES.dashboard} className="font-semibold text-forest-900 underline underline-offset-4">
            Continue to the guest preview
          </Link>
        </p>
      </AlertDescription>
    </Alert>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FieldErrors<"email" | "password">>({});
  const [submitted, setSubmitted] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateSignIn({ email, password });
    setErrors(found);
    setSubmitted(Object.keys(found).length === 0);
    if (Object.keys(found).length) focusFirstError("signin", found);
    else setPassword("");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormField id="signin-email" label="Email" error={errors.email}>
        {(field) => (
          <Input
            {...field}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined }));
            }}
          />
        )}
      </FormField>
      <FormField id="signin-password" label="Password" error={errors.password}>
        {(field) => (
          <PasswordInput
            {...field}
            autoComplete="current-password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
          />
        )}
      </FormField>
      <div className="flex items-center gap-3">
        <Checkbox id="signin-remember" checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} />
        <Label htmlFor="signin-remember" className="font-medium">
          Keep me signed in
        </Label>
      </div>
      <Button type="submit" size="lg" className="w-full">
        Sign in
        <ArrowRight />
      </Button>
      <div aria-live="polite">{submitted && <NotConnected />}</div>
    </form>
  );
}

function SignUpForm() {
  const [values, setValues] = useState({ name: "", email: "", password: "", terms: false });
  const [errors, setErrors] = useState<FieldErrors<"name" | "email" | "password" | "terms">>({});
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = validateSignUp(values);
    setErrors(found);
    setSubmitted(Object.keys(found).length === 0);
    if (Object.keys(found).length) focusFirstError("signup", found);
    else set("password", "");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormField id="signup-name" label="Full name" error={errors.name}>
        {(field) => (
          <Input {...field} autoComplete="name" value={values.name} onChange={(event) => set("name", event.target.value)} />
        )}
      </FormField>
      <FormField id="signup-email" label="Email" error={errors.email}>
        {(field) => (
          <Input
            {...field}
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => set("email", event.target.value)}
          />
        )}
      </FormField>
      <FormField id="signup-password" label="Password" hint="At least 8 characters." error={errors.password}>
        {(field) => (
          <PasswordInput
            {...field}
            autoComplete="new-password"
            value={values.password}
            onChange={(value) => set("password", value)}
          />
        )}
      </FormField>
      <div className="grid gap-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="signup-terms"
            checked={values.terms}
            onCheckedChange={(checked) => set("terms", checked === true)}
            aria-invalid={Boolean(errors.terms)}
            aria-describedby={errors.terms ? "signup-terms-error" : undefined}
            className="mt-0.5"
          />
          <Label htmlFor="signup-terms" className="leading-snug font-medium">
            I agree to the terms and privacy policy
          </Label>
        </div>
        {errors.terms && (
          <p id="signup-terms-error" className="text-xs font-medium text-destructive">
            {errors.terms}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" className="w-full">
        Create account
        <ArrowRight />
      </Button>
      <div aria-live="polite">{submitted && <NotConnected />}</div>
    </form>
  );
}

export function LoginForm() {
  return (
    <Tabs defaultValue="sign-in" className="gap-8">
      <TabsList aria-label="Account" className="w-full [&>button]:flex-1">
        <TabsTrigger value="sign-in">Sign in</TabsTrigger>
        <TabsTrigger value="sign-up">Create account</TabsTrigger>
      </TabsList>
      <TabsContent value="sign-in">
        <SignInForm />
      </TabsContent>
      <TabsContent value="sign-up">
        <SignUpForm />
      </TabsContent>
    </Tabs>
  );
}
