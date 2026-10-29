import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

import { SetupRequired } from "@/components/auth/access-states";
import { AuthFormSkeleton, AuthShell } from "@/components/auth/auth-shell";
import { AUTH_PATHS, isClerkConfigured } from "@/lib/auth/config";
import { ROUTES } from "@/lib/navigation";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" description="Sign in to save your preferences, plan your days and see your bookings.">
      {isClerkConfigured() ? (
        // <SignIn /> reads the URL on this catch-all route, so it needs a Suspense boundary.
        <Suspense fallback={<AuthFormSkeleton />}>
          <SignIn path={AUTH_PATHS.signIn} signUpUrl={AUTH_PATHS.signUp} fallbackRedirectUrl={AUTH_PATHS.afterSignIn} />
        </Suspense>
      ) : (
        <div className="space-y-4">
          <SetupRequired missing="auth" />
          <p className="text-center text-sm text-muted-foreground">
            You can still <Link href={ROUTES.experiences} className="font-semibold text-foreground underline underline-offset-4">browse experiences</Link> without an account.
          </p>
        </div>
      )}
    </AuthShell>
  );
}
