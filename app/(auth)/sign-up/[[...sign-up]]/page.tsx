import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";

import { SetupRequired } from "@/components/auth/access-states";
import { AuthFormSkeleton, AuthShell } from "@/components/auth/auth-shell";
import { AUTH_PATHS, isClerkConfigured } from "@/lib/auth/config";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      description="New accounts are guest accounts. Staff and administrator access is granted by the resort team."
    >
      {isClerkConfigured() ? (
        <Suspense fallback={<AuthFormSkeleton />}>
          <SignUp path={AUTH_PATHS.signUp} signInUrl={AUTH_PATHS.signIn} fallbackRedirectUrl={AUTH_PATHS.afterSignIn} />
        </Suspense>
      ) : (
        <SetupRequired missing="auth" />
      )}
    </AuthShell>
  );
}
