// Server-side configuration checks. Without both Clerk keys, sign-in is unavailable and
// every protected area fails closed (redirects to /login, which explains the setup).
// There is no fallback identity and no bypass.

const PUBLISHABLE_KEY = /^pk_(test|live)_[A-Za-z0-9+/=_-]+$/;
const SECRET_KEY = /^sk_(test|live)_[A-Za-z0-9+/=_-]+$/;

export function isClerkConfigured() {
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const secret = process.env.CLERK_SECRET_KEY ?? "";
  return PUBLISHABLE_KEY.test(publishable) && SECRET_KEY.test(secret);
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export const AUTH_PATHS = {
  signIn: "/login",
  signUp: "/sign-up",
  afterSignIn: "/dashboard",
} as const;
