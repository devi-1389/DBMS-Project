// Server-side configuration checks. Without both Clerk keys, sign-in is unavailable and
// every protected area fails closed (redirects to /login, which explains the setup).
// There is no fallback identity and no bypass.

const KEY_BODY = /^[A-Za-z0-9+/=_-]+$/;

export type ConfigProblem = { name: string; problem: string };

/** What's wrong with one Clerk key, in words. Never includes the value itself. */
function keyProblem(value: string | undefined, kind: "pk" | "sk"): string | null {
  const other = kind === "pk" ? "sk" : "pk";
  if (!value) return "isn't set";
  if (value !== value.trim() || /["'`]/.test(value)) return "has spaces or quotes around it. Paste only the key";
  if (/…|\.\.\./.test(value)) return "is the shortened key from the dashboard (it contains “…”). Copy the full key";
  if (value.startsWith(`${other}_`)) {
    return `holds the ${kind === "pk" ? "secret" : "publishable"} key. The two values are swapped`;
  }
  const match = /^(pk|sk)_(test|live)_(.+)$/.exec(value);
  if (!match || match[1] !== kind) return `should start with ${kind}_test_ or ${kind}_live_`;
  if (!KEY_BODY.test(match[3])) return "contains characters a Clerk key can't have. Copy it again";
  return null;
}

/** Problems with the Clerk keys, for the setup notice. Empty when sign-in can work. */
export function clerkKeyProblems(): ConfigProblem[] {
  return [
    { name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", problem: keyProblem(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, "pk") },
    { name: "CLERK_SECRET_KEY", problem: keyProblem(process.env.CLERK_SECRET_KEY, "sk") },
  ].filter((item): item is ConfigProblem => item.problem !== null);
}

export function isClerkConfigured() {
  return clerkKeyProblems().length === 0;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export const AUTH_PATHS = {
  signIn: "/login",
  signUp: "/sign-up",
  afterSignIn: "/dashboard",
} as const;
