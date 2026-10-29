import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { AUTH_PATHS, isClerkConfigured } from "@/lib/auth/config";
import { protectedAreaFor } from "@/lib/auth/routes";

// Next.js 16 proxy (formerly middleware). Following Clerk's current guidance, every
// page, Server Action and Route Handler checks auth itself; the redirect below is
// only an early 307 for signed-out visitors, not what protects anything.
const withClerk = clerkMiddleware(
  async (auth, req) => {
    if (!protectedAreaFor(req.nextUrl.pathname)) return;
    const { isAuthenticated, redirectToSignIn } = await auth();
    if (!isAuthenticated) return redirectToSignIn({ returnBackUrl: req.url });
  },
  // Our own sign-in pages, so no NEXT_PUBLIC_CLERK_SIGN_*_URL variables are needed.
  { signInUrl: AUTH_PATHS.signIn, signUpUrl: AUTH_PATHS.signUp },
);

/** Without Clerk keys nobody can sign in, so protected areas fail closed. */
function withoutClerk(req: NextRequest) {
  if (!protectedAreaFor(req.nextUrl.pathname)) return NextResponse.next();
  const url = new URL(AUTH_PATHS.signIn, req.url);
  url.searchParams.set("redirect_url", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  return isClerkConfigured() ? withClerk(req, event) : withoutClerk(req);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Always run for Clerk-specific frontend API routes
    "/__clerk/(.*)",
  ],
};
