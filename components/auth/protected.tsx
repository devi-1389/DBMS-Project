import { redirect } from "next/navigation";

import { AccessDenied, UnavailableState } from "@/components/auth/access-states";
import { AUTH_PATHS } from "@/lib/auth/config";
import { checkPageAccess } from "@/lib/auth/guards";
import type { Area } from "@/lib/auth/roles";
import type { Viewer } from "@/lib/auth/types";

/**
 * Page-level authorization (render inside <Suspense>). The proxy's early redirect is
 * only a convenience; this check runs on every request, server-side.
 */
export async function Protected({
  area,
  returnTo,
  children,
}: {
  area: Area;
  returnTo: string;
  children: (viewer: Viewer) => React.ReactNode;
}) {
  const access = await checkPageAccess(area);
  if (access.kind === "sign-in") redirect(`${AUTH_PATHS.signIn}?redirect_url=${encodeURIComponent(returnTo)}`);
  if (access.kind === "unavailable") return <UnavailableState state={access.state} />;
  if (access.kind === "forbidden") return <AccessDenied area={area} role={access.viewer.role} />;
  return children(access.viewer);
}
