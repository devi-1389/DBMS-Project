// Shared helpers for database scripts. They never print connection strings.

export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // File not present: rely on the environment.
    }
  }
}

/** Direct (unpooled) URL for DDL and bulk writes, falling back to DATABASE_URL. */
export function connectionString({ direct }: { direct: boolean }) {
  const url = (direct && process.env.DATABASE_URL_UNPOOLED) || process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon development branch connection strings.",
    );
    process.exit(1);
  }
  return url;
}

export function refuseProduction(action: string, override = false) {
  const production = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (production && !override) {
    console.error(`Refusing to ${action}: NODE_ENV or VERCEL_ENV is "production".`);
    process.exit(1);
  }
}

export function describeError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const code = "code" in error && error.code ? ` [${String(error.code)}]` : "";
    return `${String(error.message)}${code}`;
  }
  return String(error);
}
