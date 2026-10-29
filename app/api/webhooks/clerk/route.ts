import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

import { isDatabaseConfigured } from "@/lib/auth/config";
import { getDb } from "@/lib/db";
import { provisionViewer, syncIdentityProfile, unlinkIdentity } from "@/lib/dal/identity";

// Clerk → database sync. Public by design (webhooks carry no session), so every
// request must pass Svix signature verification with CLERK_WEBHOOK_SIGNING_SECRET.
// First sign-in also provisions lazily, because webhooks can't reach localhost.
export async function POST(req: NextRequest) {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET || !isDatabaseConfigured()) {
    return new Response("Webhook endpoint is not configured", { status: 503 });
  }

  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  const db = getDb();
  if (evt.type === "user.created" || evt.type === "user.updated") {
    const primary = evt.data.email_addresses.find((email) => email.id === evt.data.primary_email_address_id);
    // Only provider-verified emails are linked or synced.
    if (primary?.verification?.status === "verified") {
      const identity = {
        provider: "clerk" as const,
        providerUserId: evt.data.id,
        email: primary.email_address,
        firstName: evt.data.first_name,
        lastName: evt.data.last_name,
      };
      if (evt.type === "user.created") await provisionViewer(db, identity);
      else await syncIdentityProfile(db, identity);
    }
  } else if (evt.type === "user.deleted" && evt.data.id) {
    await unlinkIdentity(db, { provider: "clerk", providerUserId: evt.data.id });
  }

  return new Response("OK", { status: 200 });
}
