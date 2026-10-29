import { afterEach, describe, expect, it, vi } from "vitest";

import { clerkKeyProblems, isClerkConfigured } from "@/lib/auth/config";
import { canAccess, isRole, ROLES } from "@/lib/auth/roles";
import { protectedAreaFor, safeReturnPath } from "@/lib/auth/routes";

describe("role areas", () => {
  it("lets each role into exactly the areas it should reach", () => {
    const matrix = Object.fromEntries(
      ROLES.map((role) => [role, (["guest", "staff", "admin"] as const).filter((area) => canAccess(role, area))]),
    );
    expect(matrix).toEqual({
      guest: ["guest"],
      staff: ["guest", "staff"],
      admin: ["guest", "staff", "admin"],
    });
  });

  it("recognises only known roles", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("superuser")).toBe(false);
    expect(isRole("Admin")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});

describe("protected routes", () => {
  it.each([
    ["/dashboard", "guest"],
    ["/recommendations", "guest"],
    ["/itinerary", "guest"],
    ["/preferences", "guest"],
    ["/my-bookings/LX-4KQ7", "guest"],
    ["/staff", "staff"],
    ["/admin", "admin"],
    ["/admin/anything", "admin"],
  ])("%s needs the %s area", (path, area) => {
    expect(protectedAreaFor(path)).toBe(area);
  });

  it.each(["/", "/experiences", "/experiences/lakeside-sunrise-yoga", "/login", "/sign-up", "/administrator", "/staffing"])(
    "%s is public",
    (path) => {
      expect(protectedAreaFor(path)).toBeNull();
    },
  );

  it("only accepts same-site relative return paths", () => {
    expect(safeReturnPath("/itinerary?plan=1")).toBe("/itinerary?plan=1");
    expect(safeReturnPath("https://evil.example")).toBe("/dashboard");
    expect(safeReturnPath("//evil.example")).toBe("/dashboard");
    expect(safeReturnPath("/\\evil.example")).toBe("/dashboard");
    expect(safeReturnPath(null)).toBe("/dashboard");
  });
});

describe("Clerk configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("explains what's wrong with each key, without the value", () => {
    const problems = (publishable: string, secret: string) => {
      vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", publishable);
      vi.stubEnv("CLERK_SECRET_KEY", secret);
      return Object.fromEntries(clerkKeyProblems().map((item) => [item.name, item.problem]));
    };
    expect(problems("", "")).toEqual({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "isn't set",
      CLERK_SECRET_KEY: "isn't set",
    });
    expect(problems("pk_test_abc123", "sk_test_o…TEaJ").CLERK_SECRET_KEY).toMatch(/shortened key/);
    expect(problems("pk_test_abc123", " sk_test_abc ").CLERK_SECRET_KEY).toMatch(/spaces or quotes/);
    expect(problems("sk_test_abc", "pk_test_abc").NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toMatch(/swapped/);
    expect(problems("pk_abc", "sk_test_abc").NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toMatch(/should start with pk_test_/);
    expect(problems("pk_test_abc123", "sk_test_abc123")).toEqual({});
    expect(JSON.stringify(problems("pk_test_abc123", "sk_test_o…TEaJ"))).not.toContain("TEaJ");
  });

  it("is off unless both keys look real", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    expect(isClerkConfigured()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k");
    expect(isClerkConfigured()).toBe(false);
    vi.stubEnv("CLERK_SECRET_KEY", "changeme");
    expect(isClerkConfigured()).toBe(false);
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_abc123");
    expect(isClerkConfigured()).toBe(true);
  });
});
