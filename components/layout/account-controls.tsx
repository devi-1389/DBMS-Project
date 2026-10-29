import { AccountMenu, MobileAccountLinks, SignInButtons, type AccountSummary } from "@/components/layout/account-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { isClerkConfigured } from "@/lib/auth/config";
import { getViewerState } from "@/lib/auth/viewer";

async function accountState(): Promise<{ signedIn: boolean; viewer: AccountSummary }> {
  if (!isClerkConfigured()) return { signedIn: false, viewer: null };
  const state = await getViewerState();
  if (state.status === "signed-out" || state.status === "auth-unconfigured") return { signedIn: false, viewer: null };
  return {
    signedIn: true,
    viewer: state.status === "signed-in" ? { displayName: state.viewer.displayName, role: state.viewer.role } : null,
  };
}

/** Header account area. Reads the session, so it renders inside <Suspense>. */
export async function AccountControls() {
  const { signedIn, viewer } = await accountState();
  return signedIn ? <AccountMenu viewer={viewer} /> : <SignInButtons />;
}

export async function MobileAccountControls() {
  const { signedIn, viewer } = await accountState();
  return <MobileAccountLinks viewer={viewer} signedIn={signedIn} />;
}

export function AccountControlsFallback() {
  return <Skeleton className="hidden h-10 w-28 rounded-full sm:block" />;
}
