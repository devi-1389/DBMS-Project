import { relations } from "drizzle-orm";

import { bookings, bookingStatusHistory, paymentAttempts, reviews } from "./bookings";
import {
  blackoutPeriods,
  experienceCategories,
  experienceHighlights,
  experienceInterests,
  experiences,
  experienceSlots,
  suppliers,
} from "./catalogue";
import { authIdentities, guestProfiles, staffMembers, users } from "./identity";
import { itineraryItems, itineraryPlans } from "./itinerary";
import { resourceAllocations, staffAssignments } from "./operations";
import { guestInterests, guestPreferences, guestPreferredTimes, interests } from "./preferences";
import { experienceResourceRequirements, resourceMaintenance, resources } from "./resources";

export const usersRelations = relations(users, ({ many, one }) => ({
  identities: many(authIdentities),
  guestProfile: one(guestProfiles),
  staffMember: one(staffMembers),
}));

export const authIdentitiesRelations = relations(authIdentities, ({ one }) => ({
  user: one(users, { fields: [authIdentities.userId], references: [users.id] }),
}));

export const guestProfilesRelations = relations(guestProfiles, ({ one, many }) => ({
  user: one(users, { fields: [guestProfiles.userId], references: [users.id] }),
  preferences: one(guestPreferences),
  interests: many(guestInterests),
  preferredTimes: many(guestPreferredTimes),
  bookings: many(bookings),
  itineraryPlans: many(itineraryPlans),
}));

export const guestPreferencesRelations = relations(guestPreferences, ({ one }) => ({
  guest: one(guestProfiles, { fields: [guestPreferences.guestId], references: [guestProfiles.userId] }),
}));

export const guestInterestsRelations = relations(guestInterests, ({ one }) => ({
  guest: one(guestProfiles, { fields: [guestInterests.guestId], references: [guestProfiles.userId] }),
  interest: one(interests, { fields: [guestInterests.interestId], references: [interests.id] }),
}));

export const guestPreferredTimesRelations = relations(guestPreferredTimes, ({ one }) => ({
  guest: one(guestProfiles, { fields: [guestPreferredTimes.guestId], references: [guestProfiles.userId] }),
}));

export const interestsRelations = relations(interests, ({ many }) => ({
  guests: many(guestInterests),
  experiences: many(experienceInterests),
}));

export const experienceCategoriesRelations = relations(experienceCategories, ({ many }) => ({
  experiences: many(experiences),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  experiences: many(experiences),
  resources: many(resources),
}));

export const experiencesRelations = relations(experiences, ({ one, many }) => ({
  category: one(experienceCategories, { fields: [experiences.categoryId], references: [experienceCategories.id] }),
  supplier: one(suppliers, { fields: [experiences.supplierId], references: [suppliers.id] }),
  highlights: many(experienceHighlights),
  interests: many(experienceInterests),
  slots: many(experienceSlots),
  requirements: many(experienceResourceRequirements),
  blackouts: many(blackoutPeriods),
}));

export const experienceHighlightsRelations = relations(experienceHighlights, ({ one }) => ({
  experience: one(experiences, { fields: [experienceHighlights.experienceId], references: [experiences.id] }),
}));

export const experienceInterestsRelations = relations(experienceInterests, ({ one }) => ({
  experience: one(experiences, { fields: [experienceInterests.experienceId], references: [experiences.id] }),
  interest: one(interests, { fields: [experienceInterests.interestId], references: [interests.id] }),
}));

export const experienceSlotsRelations = relations(experienceSlots, ({ one, many }) => ({
  experience: one(experiences, { fields: [experienceSlots.experienceId], references: [experiences.id] }),
  bookings: many(bookings),
  staffAssignments: many(staffAssignments),
  resourceAllocations: many(resourceAllocations),
}));

export const blackoutPeriodsRelations = relations(blackoutPeriods, ({ one }) => ({
  experience: one(experiences, { fields: [blackoutPeriods.experienceId], references: [experiences.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  guest: one(guestProfiles, { fields: [bookings.guestId], references: [guestProfiles.userId] }),
  slot: one(experienceSlots, { fields: [bookings.slotId], references: [experienceSlots.id] }),
  statusHistory: many(bookingStatusHistory),
  payments: many(paymentAttempts),
  review: one(reviews),
  resourceAllocations: many(resourceAllocations),
}));

export const bookingStatusHistoryRelations = relations(bookingStatusHistory, ({ one }) => ({
  booking: one(bookings, { fields: [bookingStatusHistory.bookingId], references: [bookings.id] }),
}));

export const paymentAttemptsRelations = relations(paymentAttempts, ({ one }) => ({
  booking: one(bookings, { fields: [paymentAttempts.bookingId], references: [bookings.id] }),
  recordedBy: one(staffMembers, { fields: [paymentAttempts.recordedByStaffId], references: [staffMembers.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  booking: one(bookings, { fields: [reviews.bookingId], references: [bookings.id] }),
}));

export const staffMembersRelations = relations(staffMembers, ({ one, many }) => ({
  user: one(users, { fields: [staffMembers.userId], references: [users.id] }),
  assignments: many(staffAssignments),
}));

export const staffAssignmentsRelations = relations(staffAssignments, ({ one }) => ({
  slot: one(experienceSlots, { fields: [staffAssignments.slotId], references: [experienceSlots.id] }),
  staff: one(staffMembers, { fields: [staffAssignments.staffId], references: [staffMembers.id] }),
}));

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [resources.supplierId], references: [suppliers.id] }),
  requirements: many(experienceResourceRequirements),
  allocations: many(resourceAllocations),
  maintenance: many(resourceMaintenance),
}));

export const experienceResourceRequirementsRelations = relations(experienceResourceRequirements, ({ one }) => ({
  experience: one(experiences, {
    fields: [experienceResourceRequirements.experienceId],
    references: [experiences.id],
  }),
  resource: one(resources, { fields: [experienceResourceRequirements.resourceId], references: [resources.id] }),
}));

export const resourceAllocationsRelations = relations(resourceAllocations, ({ one }) => ({
  resource: one(resources, { fields: [resourceAllocations.resourceId], references: [resources.id] }),
  slot: one(experienceSlots, { fields: [resourceAllocations.slotId], references: [experienceSlots.id] }),
  booking: one(bookings, { fields: [resourceAllocations.bookingId], references: [bookings.id] }),
}));

export const resourceMaintenanceRelations = relations(resourceMaintenance, ({ one }) => ({
  resource: one(resources, { fields: [resourceMaintenance.resourceId], references: [resources.id] }),
}));

export const itineraryPlansRelations = relations(itineraryPlans, ({ one, many }) => ({
  guest: one(guestProfiles, { fields: [itineraryPlans.guestId], references: [guestProfiles.userId] }),
  items: many(itineraryItems),
}));

export const itineraryItemsRelations = relations(itineraryItems, ({ one }) => ({
  plan: one(itineraryPlans, { fields: [itineraryItems.planId], references: [itineraryPlans.id] }),
  slot: one(experienceSlots, { fields: [itineraryItems.slotId], references: [experienceSlots.id] }),
  booking: one(bookings, { fields: [itineraryItems.bookingId], references: [bookings.id] }),
}));
