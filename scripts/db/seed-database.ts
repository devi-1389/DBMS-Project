// Development seed. Reuses the frontend's sample catalogue (experiences, sessions,
// sample bookings), the app's category and interest constants, and adds the
// operational sample data from ./seed-data. Works with any Drizzle Postgres driver.
import { randomUUID } from "node:crypto";

import { getTableName, inArray, is, sql } from "drizzle-orm";
import { PgTable, type PgDatabase, type PgQueryResultHKT } from "drizzle-orm/pg-core";

import { CATEGORY_LABELS, EXPERIENCE_CATEGORIES } from "@/lib/categories";
import * as schema from "@/lib/db/schema";
import { INTERESTS } from "@/lib/interests";
import { minorToDecimal } from "@/lib/money";
import { listExperiences, listSampleBookings, listSlots, SAMPLE_WINDOW } from "@/lib/placeholder/catalogue";
import { categoryHighlights } from "@/lib/placeholder/landing";

import * as data from "./seed-data";

export type SeedDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

const slotKey = (experienceSlug: string, startsAt: string | Date) =>
  `${experienceSlug}|${new Date(startsAt).toISOString()}`;

/** Names of every table in the schema, for TRUNCATE. */
export function seededTables() {
  return (Object.values(schema) as unknown[])
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => getTableName(table));
}

export async function resetDatabase(db: SeedDatabase) {
  const tables = seededTables().map((name) => `"${name}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`));
}

export async function seedDatabase(db: SeedDatabase, log: (message: string) => void = () => {}) {
  const [catalogue, sessions, sampleBookings] = await Promise.all([
    listExperiences(),
    listSlots(),
    listSampleBookings(),
  ]);
  const catalogueBySlug = new Map(catalogue.map((experience) => [experience.slug, experience]));

  /* --------------------------------------------------------------- lookups */
  const interestRows = await db
    .insert(schema.interests)
    .values(INTERESTS.map((interest) => ({ slug: interest.id, label: interest.label })))
    .returning({ id: schema.interests.id, slug: schema.interests.slug });
  const interestIds = new Map(interestRows.map((row) => [row.slug, row.id]));

  const categoryRows = await db
    .insert(schema.experienceCategories)
    .values(
      EXPERIENCE_CATEGORIES.map((slug, index) => {
        const copy = categoryHighlights.find((highlight) => highlight.category === slug);
        return {
          slug,
          label: CATEGORY_LABELS[slug],
          tagline: copy?.tagline,
          description: copy?.description,
          sortOrder: index + 1,
        };
      }),
    )
    .returning({ id: schema.experienceCategories.id, slug: schema.experienceCategories.slug });
  const categoryIds = new Map(categoryRows.map((row) => [row.slug, row.id]));
  log(`interests ${interestRows.length}, categories ${categoryRows.length}`);

  /* --------------------------------------------------------------- people */
  const guestNames = [...new Set(sampleBookings.map((booking) => booking.guestName))];
  const staffWithAccounts = data.staff.filter((member) => member.hasAccount);

  const userRows = await db
    .insert(schema.users)
    .values([
      { email: data.admin.email, displayName: data.admin.displayName, role: "admin" as const },
      ...staffWithAccounts.map((member) => ({
        email: member.email,
        displayName: member.displayName,
        role: "staff" as const,
      })),
      ...guestNames.map((name) => ({ email: data.guestEmail(name), displayName: name, role: "guest" as const })),
    ])
    .returning({ id: schema.users.id, email: schema.users.email });
  const userIds = new Map(userRows.map((row) => [row.email, row.id]));
  const adminId = userIds.get(data.admin.email)!;

  await db.insert(schema.authIdentities).values(
    userRows.map((row, index) => ({
      userId: row.id,
      provider: "clerk" as const,
      // Placeholder IDs; real ones come from Clerk webhooks in Phase 3.
      providerUserId: `user_seed_${String(index + 1).padStart(3, "0")}`,
    })),
  );

  await db.insert(schema.guestProfiles).values(
    guestNames.map((name) => {
      const [first, ...rest] = name.split(" ");
      return {
        userId: userIds.get(data.guestEmail(name))!,
        firstName: first,
        lastName: rest.join(" ") || "Guest",
      };
    }),
  );
  const guestIds = new Map(guestNames.map((name) => [name, userIds.get(data.guestEmail(name))!]));

  const staffRows = await db
    .insert(schema.staffMembers)
    .values(
      data.staff.map((member) => ({
        userId: member.hasAccount ? userIds.get(member.email)! : null,
        displayName: member.displayName,
        jobTitle: member.jobTitle,
        email: member.email,
        hiredOn: member.hiredOn,
      })),
    )
    .returning({ id: schema.staffMembers.id, email: schema.staffMembers.email });
  const staffIds = new Map(data.staff.map((member) => [member.key, staffRows.find((row) => row.email === member.email)!.id]));
  log(`users ${userRows.length}, guests ${guestNames.length}, staff ${staffRows.length}`);

  /* --------------------------------------------------------------- catalogue */
  const supplierRows = await db
    .insert(schema.suppliers)
    .values(data.suppliers.map((supplier) => ({ name: supplier.name, kind: supplier.kind, contactEmail: supplier.contactEmail })))
    .returning({ id: schema.suppliers.id, name: schema.suppliers.name });
  const supplierIds = new Map(supplierRows.map((row) => [row.name, row.id]));
  const supplierBySlug = new Map(
    data.suppliers.flatMap((supplier) => supplier.experiences.map((slug) => [slug, supplierIds.get(supplier.name)!])),
  );

  const experienceRows = await db
    .insert(schema.experiences)
    .values(
      catalogue.map((experience) => ({
        categoryId: categoryIds.get(experience.category)!,
        supplierId: supplierBySlug.get(experience.slug) ?? null,
        slug: experience.slug,
        title: experience.title,
        summary: experience.summary,
        description: experience.description,
        location: experience.location,
        meetingPoint: experience.meetingPoint,
        difficulty: experience.difficulty,
        durationMinutes: experience.durationMinutes,
        minAge: experience.minAge,
        maxGroupSize: experience.maxGroupSize,
        basePrice: minorToDecimal(experience.priceFromMinor),
        currency: experience.currency,
        isStepFree: experience.accessible,
        isFeatured: experience.featured,
        status: "published" as const,
        imageUrl: experience.image.src,
        imageAlt: experience.image.alt,
      })),
    )
    .returning({ id: schema.experiences.id, slug: schema.experiences.slug });
  const experienceIds = new Map(experienceRows.map((row) => [row.slug, row.id]));

  await db.insert(schema.experienceHighlights).values(
    catalogue.flatMap((experience) =>
      experience.highlights.map((text, index) => ({
        experienceId: experienceIds.get(experience.slug)!,
        position: index + 1,
        text,
      })),
    ),
  );
  await db.insert(schema.experienceInterests).values(
    catalogue.flatMap((experience) =>
      experience.interests.map((interest) => ({
        experienceId: experienceIds.get(experience.slug)!,
        interestId: interestIds.get(interest)!,
      })),
    ),
  );
  log(`suppliers ${supplierRows.length}, experiences ${experienceRows.length}`);

  /* --------------------------------------------------------------- schedule */
  // Blackouts first: the slot trigger refuses to schedule sessions inside one.
  await db.insert(schema.blackoutPeriods).values(
    data.blackouts.map((blackout) => ({
      experienceId: blackout.experience ? experienceIds.get(blackout.experience)! : null,
      startsAt: new Date(blackout.startsAt),
      endsAt: new Date(blackout.endsAt),
      reason: blackout.reason,
      createdByUserId: adminId,
    })),
  );
  const blackoutFor = (slug: string, startsAt: string, endsAt: string) =>
    data.blackouts.find(
      (blackout) =>
        (blackout.experience === null || blackout.experience === slug) &&
        blackout.startsAt < endsAt &&
        startsAt < blackout.endsAt,
    );

  // Past sample bookings (before the sample season) need sessions of their own.
  const pastSessions = sampleBookings
    .filter((booking) => booking.startsAt < `${SAMPLE_WINDOW.start}T00:00:00.000Z`)
    .map((booking) => ({
      experienceSlug: booking.experienceSlug,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      capacity: catalogueBySlug.get(booking.experienceSlug)!.maxGroupSize,
    }));

  const slotRows = await db
    .insert(schema.experienceSlots)
    .values(
      [...sessions, ...pastSessions].map((session) => {
        const blackout = blackoutFor(session.experienceSlug, session.startsAt, session.endsAt);
        return {
          experienceId: experienceIds.get(session.experienceSlug)!,
          startsAt: new Date(session.startsAt),
          endsAt: new Date(session.endsAt),
          // Seat counts start at 0: only bookings change them (via trigger).
          capacity: session.capacity,
          status: blackout ? ("cancelled" as const) : ("scheduled" as const),
          cancelledReason: blackout?.reason ?? null,
        };
      }),
    )
    .returning({
      id: schema.experienceSlots.id,
      experienceId: schema.experienceSlots.experienceId,
      startsAt: schema.experienceSlots.startsAt,
      status: schema.experienceSlots.status,
    });
  const slugByExperienceId = new Map(experienceRows.map((row) => [row.id, row.slug]));
  const slotIds = new Map(slotRows.map((row) => [slotKey(slugByExperienceId.get(row.experienceId)!, row.startsAt), row.id]));
  const scheduledSlots = slotRows
    .filter((row) => row.status === "scheduled")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  log(`slots ${slotRows.length} (${slotRows.length - scheduledSlots.length} cancelled for blackouts)`);

  /* --------------------------------------------------------------- staff */
  const leadBySlug = new Map(data.staff.flatMap((member) => member.leads.map((slug) => [slug, staffIds.get(member.key)!])));
  const assignmentRows = await db
    .insert(schema.staffAssignments)
    .values(
      scheduledSlots.map((slot) => ({
        slotId: slot.id,
        staffId: leadBySlug.get(slugByExperienceId.get(slot.experienceId)!)!,
        role: "lead" as const,
      })),
    )
    .returning({ id: schema.staffAssignments.id });
  log(`staff assignments ${assignmentRows.length}`);

  /* --------------------------------------------------------------- resources */
  const resourceRows = await db
    .insert(schema.resources)
    .values(
      data.resources.map((resource) => ({
        name: resource.name,
        kind: resource.kind,
        quantityTotal: resource.quantity,
        location: resource.location,
        supplierId: resource.supplier ? supplierIds.get(resource.supplier)! : null,
      })),
    )
    .returning({ id: schema.resources.id, name: schema.resources.name });
  const resourceIds = new Map(resourceRows.map((row) => [row.name, row.id]));

  await db.insert(schema.experienceResourceRequirements).values(
    data.requirements.map((requirement) => ({
      experienceId: experienceIds.get(requirement.experience)!,
      resourceId: resourceIds.get(requirement.resource)!,
      basis: requirement.basis,
      quantity: requirement.quantity,
    })),
  );
  await db.insert(schema.resourceMaintenance).values(
    data.maintenance.map((window) => ({
      resourceId: resourceIds.get(window.resource)!,
      startsAt: new Date(window.startsAt),
      endsAt: new Date(window.endsAt),
      quantityOut: window.quantityOut,
      reason: window.reason,
    })),
  );

  // Session-level holds, in start order so the capacity trigger sees earlier holds.
  const sessionHolds = scheduledSlots.flatMap((slot) =>
    data.requirements
      .filter((requirement) => requirement.basis === "per_session" && requirement.experience === slugByExperienceId.get(slot.experienceId))
      .map((requirement) => ({
        resourceId: resourceIds.get(requirement.resource)!,
        slotId: slot.id,
        quantity: requirement.quantity,
      })),
  );
  if (sessionHolds.length) await db.insert(schema.resourceAllocations).values(sessionHolds);
  log(`resources ${resourceRows.length}, requirements ${data.requirements.length}, session holds ${sessionHolds.length}`);

  /* --------------------------------------------------------------- bookings */
  // Every booking starts pending or confirmed (enforced by trigger); final statuses
  // are reached through valid transitions so the status history is realistic.
  await db.execute(sql`select set_config('luxe.actor_user_id', ${adminId}, true)`);

  const bookingRows = await db
    .insert(schema.bookings)
    .values(
      sampleBookings.map((booking) => {
        const experience = catalogueBySlug.get(booking.experienceSlug)!;
        const pending = booking.status === "pending";
        return {
          reference: booking.reference,
          guestId: guestIds.get(booking.guestName)!,
          slotId: slotIds.get(slotKey(booking.experienceSlug, booking.startsAt))!,
          partySize: booking.partySize,
          unitPrice: minorToDecimal(experience.priceFromMinor),
          currency: experience.currency,
          status: pending ? ("pending" as const) : ("confirmed" as const),
          holdExpiresAt: pending ? new Date(Date.parse(booking.startsAt) - 86_400_000) : null,
          idempotencyKey: randomUUID(),
        };
      }),
    )
    .returning({ id: schema.bookings.id, reference: schema.bookings.reference, slotId: schema.bookings.slotId });
  const bookingIds = new Map(bookingRows.map((row) => [row.reference, row.id]));

  for (const status of ["completed", "cancelled", "no_show"] as const) {
    const references = sampleBookings.filter((booking) => booking.status === status).map((booking) => booking.reference);
    if (!references.length) continue;
    await db.execute(sql`select set_config('luxe.status_reason', ${`Sample data: ${status}`}, true)`);
    await db
      .update(schema.bookings)
      .set({ status })
      .where(inArray(schema.bookings.reference, references));
  }
  await db.execute(sql`select set_config('luxe.status_reason', '', true)`);

  // Sessions that already happened.
  const pastSlotIds = pastSessions.map((session) => slotIds.get(slotKey(session.experienceSlug, session.startsAt))!);
  if (pastSlotIds.length) {
    await db
      .update(schema.experienceSlots)
      .set({ status: "completed" })
      .where(inArray(schema.experienceSlots.id, pastSlotIds));
  }

  // Per-guest equipment for active bookings.
  const activeBookings = sampleBookings.filter((booking) => booking.status === "confirmed" || booking.status === "pending");
  const guestHolds = activeBookings.flatMap((booking) =>
    data.requirements
      .filter((requirement) => requirement.basis === "per_guest" && requirement.experience === booking.experienceSlug)
      .map((requirement) => ({
        resourceId: resourceIds.get(requirement.resource)!,
        slotId: slotIds.get(slotKey(booking.experienceSlug, booking.startsAt))!,
        bookingId: bookingIds.get(booking.reference)!,
        quantity: requirement.quantity * booking.partySize,
      })),
  );
  if (guestHolds.length) await db.insert(schema.resourceAllocations).values(guestHolds);
  log(`bookings ${bookingRows.length}, per-guest holds ${guestHolds.length}`);

  /* --------------------------------------------------------------- payments + reviews */
  const paymentValues = Object.entries(data.payments).map(([reference, payment]) => {
    const booking = sampleBookings.find((item) => item.reference === reference)!;
    const settled = payment.status === "succeeded";
    return {
      bookingId: bookingIds.get(reference)!,
      amount: minorToDecimal(booking.totalMinor),
      currency: booking.currency,
      method: payment.method,
      status: payment.status,
      provider: payment.method === "card" ? "sample-pay" : null,
      providerReference: payment.method === "card" ? `seed_${reference.toLowerCase()}` : null,
      failureReason: payment.failureReason ?? null,
      recordedByStaffId: payment.recordedBy ? staffIds.get(payment.recordedBy)! : null,
      attemptedAt: new Date(Date.parse(booking.startsAt) - 7 * 86_400_000),
      settledAt: settled ? new Date(Date.parse(booking.startsAt) - 7 * 86_400_000) : null,
    };
  });
  await db.insert(schema.paymentAttempts).values(paymentValues);

  await db.insert(schema.reviews).values(
    Object.entries(data.reviews).map(([reference, review]) => ({
      bookingId: bookingIds.get(reference)!,
      rating: review.rating,
      title: review.title,
      body: review.body,
      status: "published" as const,
      moderatedByUserId: adminId,
      moderatedAt: new Date(),
    })),
  );
  log(`payment attempts ${paymentValues.length}, reviews ${Object.keys(data.reviews).length}`);

  /* --------------------------------------------------------------- preferences + itinerary */
  const preferences = data.sampleGuestPreferences;
  const preferenceGuestId = guestIds.get(preferences.guestName)!;
  await db.insert(schema.guestPreferences).values({
    guestId: preferenceGuestId,
    maxDifficulty: preferences.maxDifficulty,
    budgetPerGuest: minorToDecimal(preferences.budgetPerGuestMinor),
    usualGroupSize: preferences.usualGroupSize,
    needsStepFree: preferences.needsStepFree,
    notes: preferences.notes,
  });
  await db.insert(schema.guestInterests).values(
    preferences.interests.map((interest) => ({
      guestId: preferenceGuestId,
      interestId: interestIds.get(interest.id)!,
      weight: interest.weight,
    })),
  );
  await db
    .insert(schema.guestPreferredTimes)
    .values(preferences.timesOfDay.map((timeOfDay) => ({ guestId: preferenceGuestId, timeOfDay })));

  const [plan] = await db
    .insert(schema.itineraryPlans)
    .values({
      guestId: guestIds.get(data.itinerary.guestName)!,
      name: data.itinerary.name,
      arrivalDate: data.itinerary.arrival,
      departureDate: data.itinerary.departure,
    })
    .returning({ id: schema.itineraryPlans.id });
  await db.insert(schema.itineraryItems).values(
    data.itinerary.items.map((item) => ({
      planId: plan.id,
      slotId: slotIds.get(slotKey(item.experience, item.startsAt))!,
      partySize: item.partySize,
      bookingId: item.booked ? bookingIds.get(item.booked)! : null,
    })),
  );
  log(`itinerary plans 1, items ${data.itinerary.items.length}`);
}
