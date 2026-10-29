/** Thrown when an actor's database role doesn't allow an operation. */
export class AuthorizationError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type DalResult<T> =
  | { ok: true; value: T; message?: string }
  | { ok: false; code: string; message: string; field?: string };

export const ok = <T>(value: T, message?: string): DalResult<T> => ({ ok: true, value, message });
export const fail = (code: string, message: string, field?: string): DalResult<never> => ({
  ok: false,
  code,
  message,
  field,
});

/** PostgreSQL SQLSTATE from a driver error, including errors wrapped by Drizzle. */
export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    if ("code" in current && typeof current.code === "string") return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}
