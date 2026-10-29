import Link from "next/link";
import { KeyRound, MailWarning, ShieldAlert, UserX } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { clerkKeyProblems } from "@/lib/auth/config";
import { ROLE_LABELS, type Area, type UserRole } from "@/lib/auth/roles";
import type { PageAccess } from "@/lib/auth/guards";
import { ROUTES } from "@/lib/navigation";

const AREA_LABELS: Record<Area, string> = { guest: "the guest area", staff: "the staff area", admin: "the admin console" };

export function SetupRequired({ missing }: { missing: "auth" | "database" }) {
  // Names and problems only; values never leave the server.
  const problems =
    missing === "auth" ? clerkKeyProblems() : [{ name: "DATABASE_URL", problem: "isn't set" }];
  return (
    <EmptyState
      icon={KeyRound}
      title={missing === "auth" ? "Sign-in isn't configured" : "The database isn't configured"}
      description={
        <>
          <span className="block">Protected pages stay closed until these are fixed:</span>
          <span className="mt-2 block space-y-1 text-left">
            {problems.map(({ name, problem }) => (
              <span key={name} className="block">
                <code className="rounded bg-muted px-1 text-xs">{name}</code> {problem}.
              </span>
            ))}
          </span>
          <span className="mt-2 block">
            After changing variables in Vercel, redeploy. See <code className="text-xs">docs/AUTHENTICATION.md</code>.
          </span>
        </>
      }
    >
      <Button asChild variant="outline">
        <Link href={ROUTES.home}>Back to the resort</Link>
      </Button>
    </EmptyState>
  );
}

export function AccessDenied({ area, role }: { area: Area; role: UserRole }) {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="You don't have access to this page"
      description={`${AREA_LABELS[area][0].toUpperCase()}${AREA_LABELS[area].slice(1)} needs a different role. You're signed in as ${ROLE_LABELS[role].toLowerCase()}. Roles can only be changed by an administrator.`}
    >
      <Button asChild>
        <Link href={ROUTES.dashboard}>Go to your dashboard</Link>
      </Button>
    </EmptyState>
  );
}

export function UnavailableState({ state }: { state: Extract<PageAccess, { kind: "unavailable" }>["state"] }) {
  if (state.status === "auth-unconfigured") return <SetupRequired missing="auth" />;
  if (state.status === "db-unconfigured") return <SetupRequired missing="database" />;
  if (state.status === "unverified-email") {
    return (
      <EmptyState
        icon={MailWarning}
        title="Verify your email to continue"
        description="We link your account to a verified email address. Open the verification email we sent, or add and verify an email in your account settings, then reload this page."
      />
    );
  }
  return <EmptyState icon={UserX} title="We couldn't link your account" description={state.message} />;
}
