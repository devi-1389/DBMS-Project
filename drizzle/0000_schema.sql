CREATE TYPE "public"."allocation_status" AS ENUM('held', 'released');--> statement-breakpoint
CREATE TYPE "public"."assignment_role" AS ENUM('lead', 'guide', 'support');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('assigned', 'released');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('clerk');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'cancelled', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'moderate', 'challenging');--> statement-breakpoint
CREATE TYPE "public"."experience_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('pay_at_resort', 'card');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('initiated', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."requirement_basis" AS ENUM('per_session', 'per_guest');--> statement-breakpoint
CREATE TYPE "public"."resource_kind" AS ENUM('vehicle', 'watercraft', 'equipment', 'venue', 'other');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'published', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."slot_status" AS ENUM('scheduled', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."supplier_kind" AS ENUM('activity_operator', 'local_host', 'equipment_rental', 'food_producer', 'transport');--> statement-breakpoint
CREATE TYPE "public"."time_of_day" AS ENUM('morning', 'daytime', 'evening');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('guest', 'staff', 'admin');--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	CONSTRAINT "auth_identities_provider_user_key" UNIQUE("provider","provider_user_id"),
	CONSTRAINT "auth_identities_user_provider_key" UNIQUE("user_id","provider"),
	CONSTRAINT "auth_identities_provider_user_id_length" CHECK (char_length("auth_identities"."provider_user_id") between 1 and 255)
);
--> statement-breakpoint
CREATE TABLE "guest_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text,
	"date_of_birth" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_profiles_name_length" CHECK (char_length("guest_profiles"."first_name") between 1 and 80 and char_length("guest_profiles"."last_name") between 1 and 80),
	CONSTRAINT "guest_profiles_phone_format" CHECK ("guest_profiles"."phone" is null or "guest_profiles"."phone" ~ '^\+?[0-9 ()-]{6,20}$'),
	CONSTRAINT "guest_profiles_birth_date_range" CHECK ("guest_profiles"."date_of_birth" is null or "guest_profiles"."date_of_birth" > date '1900-01-01')
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"display_name" text NOT NULL,
	"job_title" text NOT NULL,
	"email" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"hired_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_members_user_key" UNIQUE("user_id"),
	CONSTRAINT "staff_members_display_name_length" CHECK (char_length("staff_members"."display_name") between 1 and 120),
	CONSTRAINT "staff_members_job_title_length" CHECK (char_length("staff_members"."job_title") between 1 and 120),
	CONSTRAINT "staff_members_email_format" CHECK ("staff_members"."email" is null or "staff_members"."email" ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" DEFAULT 'guest' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_format" CHECK ("users"."email" ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
	CONSTRAINT "users_display_name_length" CHECK (char_length("users"."display_name") between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "guest_interests" (
	"guest_id" uuid NOT NULL,
	"interest_id" smallint NOT NULL,
	"weight" smallint DEFAULT 3 NOT NULL,
	CONSTRAINT "guest_interests_pkey" PRIMARY KEY("guest_id","interest_id"),
	CONSTRAINT "guest_interests_weight_range" CHECK ("guest_interests"."weight" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "guest_preferences" (
	"guest_id" uuid PRIMARY KEY NOT NULL,
	"max_difficulty" "difficulty" DEFAULT 'moderate' NOT NULL,
	"budget_per_guest" numeric(10, 2),
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"usual_group_size" smallint DEFAULT 2 NOT NULL,
	"needs_step_free" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_preferences_group_size_range" CHECK ("guest_preferences"."usual_group_size" between 1 and 12),
	CONSTRAINT "guest_preferences_budget_non_negative" CHECK ("guest_preferences"."budget_per_guest" is null or "guest_preferences"."budget_per_guest" >= 0),
	CONSTRAINT "guest_preferences_notes_length" CHECK (char_length("guest_preferences"."notes") <= 500),
	CONSTRAINT "guest_preferences_currency_format" CHECK ("guest_preferences"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "guest_preferred_times" (
	"guest_id" uuid NOT NULL,
	"time_of_day" time_of_day NOT NULL,
	CONSTRAINT "guest_preferred_times_pkey" PRIMARY KEY("guest_id","time_of_day")
);
--> statement-breakpoint
CREATE TABLE "interests" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "interests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "interests_slug_key" UNIQUE("slug"),
	CONSTRAINT "interests_slug_format" CHECK ("interests"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "interests_label_length" CHECK (char_length("interests"."label") between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "blackout_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blackout_periods_time_order" CHECK ("blackout_periods"."ends_at" > "blackout_periods"."starts_at"),
	CONSTRAINT "blackout_periods_reason_length" CHECK (char_length("blackout_periods"."reason") between 3 and 200)
);
--> statement-breakpoint
CREATE TABLE "experience_categories" (
	"id" smallint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "experience_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"tagline" text,
	"description" text,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "experience_categories_slug_key" UNIQUE("slug"),
	CONSTRAINT "experience_categories_slug_format" CHECK ("experience_categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "experience_categories_label_length" CHECK (char_length("experience_categories"."label") between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "experience_highlights" (
	"experience_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "experience_highlights_pkey" PRIMARY KEY("experience_id","position"),
	CONSTRAINT "experience_highlights_position_positive" CHECK ("experience_highlights"."position" >= 1),
	CONSTRAINT "experience_highlights_text_length" CHECK (char_length("experience_highlights"."text") between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "experience_interests" (
	"experience_id" uuid NOT NULL,
	"interest_id" smallint NOT NULL,
	CONSTRAINT "experience_interests_pkey" PRIMARY KEY("experience_id","interest_id")
);
--> statement-breakpoint
CREATE TABLE "experience_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experience_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"during" "tstzrange" GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED,
	"capacity" smallint NOT NULL,
	"seats_booked" smallint DEFAULT 0 NOT NULL,
	"price_override" numeric(10, 2),
	"status" "slot_status" DEFAULT 'scheduled' NOT NULL,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experience_slots_experience_start_key" UNIQUE("experience_id","starts_at"),
	CONSTRAINT "experience_slots_time_order" CHECK ("experience_slots"."ends_at" > "experience_slots"."starts_at"),
	CONSTRAINT "experience_slots_capacity_range" CHECK ("experience_slots"."capacity" between 1 and 500),
	CONSTRAINT "experience_slots_seats_within_capacity" CHECK ("experience_slots"."seats_booked" between 0 and "experience_slots"."capacity"),
	CONSTRAINT "experience_slots_price_override_non_negative" CHECK ("experience_slots"."price_override" is null or "experience_slots"."price_override" >= 0),
	CONSTRAINT "experience_slots_cancellation_reason" CHECK ("experience_slots"."status" <> 'cancelled' or "experience_slots"."cancelled_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" smallint NOT NULL,
	"supplier_id" uuid,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"description" text NOT NULL,
	"location" text NOT NULL,
	"meeting_point" text NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"duration_minutes" integer NOT NULL,
	"min_age" smallint DEFAULT 0 NOT NULL,
	"max_group_size" smallint NOT NULL,
	"base_price" numeric(10, 2) NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"is_step_free" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"status" "experience_status" DEFAULT 'draft' NOT NULL,
	"image_url" text,
	"image_alt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experiences_slug_key" UNIQUE("slug"),
	CONSTRAINT "experiences_slug_format" CHECK ("experiences"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "experiences_title_length" CHECK (char_length("experiences"."title") between 3 and 120),
	CONSTRAINT "experiences_summary_length" CHECK (char_length("experiences"."summary") between 10 and 300),
	CONSTRAINT "experiences_duration_range" CHECK ("experiences"."duration_minutes" between 15 and 1440),
	CONSTRAINT "experiences_min_age_range" CHECK ("experiences"."min_age" between 0 and 99),
	CONSTRAINT "experiences_group_size_range" CHECK ("experiences"."max_group_size" between 1 and 100),
	CONSTRAINT "experiences_base_price_non_negative" CHECK ("experiences"."base_price" >= 0),
	CONSTRAINT "experiences_currency_format" CHECK ("experiences"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "experiences_image_url_format" CHECK ("experiences"."image_url" is null or "experiences"."image_url" ~ '^(/|https://)')
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "supplier_kind" NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_name_key" UNIQUE("name"),
	CONSTRAINT "suppliers_name_length" CHECK (char_length("suppliers"."name") between 2 and 120),
	CONSTRAINT "suppliers_contact_email_format" CHECK ("suppliers"."contact_email" is null or "suppliers"."contact_email" ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);
--> statement-breakpoint
CREATE TABLE "experience_resource_requirements" (
	"experience_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"basis" "requirement_basis" DEFAULT 'per_session' NOT NULL,
	"quantity" smallint NOT NULL,
	CONSTRAINT "experience_resource_requirements_pkey" PRIMARY KEY("experience_id","resource_id"),
	CONSTRAINT "experience_resource_requirements_quantity_positive" CHECK ("experience_resource_requirements"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "resource_maintenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"quantity_out" smallint DEFAULT 1 NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_maintenance_time_order" CHECK ("resource_maintenance"."ends_at" > "resource_maintenance"."starts_at"),
	CONSTRAINT "resource_maintenance_quantity_positive" CHECK ("resource_maintenance"."quantity_out" >= 1),
	CONSTRAINT "resource_maintenance_reason_length" CHECK (char_length("resource_maintenance"."reason") between 3 and 200)
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "resource_kind" NOT NULL,
	"quantity_total" smallint NOT NULL,
	"location" text,
	"supplier_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_name_key" UNIQUE("name"),
	CONSTRAINT "resources_name_length" CHECK (char_length("resources"."name") between 2 and 120),
	CONSTRAINT "resources_quantity_range" CHECK ("resources"."quantity_total" between 1 and 10000)
);
--> statement-breakpoint
CREATE TABLE "booking_status_history" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "booking_status_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"booking_id" uuid NOT NULL,
	"from_status" "booking_status",
	"to_status" "booking_status" NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by_user_id" uuid,
	"reason" text,
	CONSTRAINT "booking_status_history_changes_status" CHECK ("booking_status_history"."from_status" is distinct from "booking_status_history"."to_status")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"guest_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"party_size" smallint NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"total_amount" numeric(12, 2) GENERATED ALWAYS AS ((unit_price * party_size)::numeric(12, 2)) STORED,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"idempotency_key" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_reference_key" UNIQUE("reference"),
	CONSTRAINT "bookings_guest_idempotency_key" UNIQUE("guest_id","idempotency_key"),
	CONSTRAINT "bookings_reference_format" CHECK ("bookings"."reference" ~ '^LX-[A-Z0-9]{4,10}$'),
	CONSTRAINT "bookings_party_size_range" CHECK ("bookings"."party_size" between 1 and 100),
	CONSTRAINT "bookings_unit_price_non_negative" CHECK ("bookings"."unit_price" >= 0),
	CONSTRAINT "bookings_currency_format" CHECK ("bookings"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "bookings_pending_has_hold" CHECK ("bookings"."status" <> 'pending' or "bookings"."hold_expires_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'initiated' NOT NULL,
	"provider" text,
	"provider_reference" text,
	"failure_reason" text,
	"recorded_by_staff_id" uuid,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "payment_attempts_provider_reference_key" UNIQUE("provider_reference"),
	CONSTRAINT "payment_attempts_amount_positive" CHECK ("payment_attempts"."amount" > 0),
	CONSTRAINT "payment_attempts_currency_format" CHECK ("payment_attempts"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "payment_attempts_card_success_has_reference" CHECK ("payment_attempts"."method" <> 'card' or "payment_attempts"."status" <> 'succeeded' or "payment_attempts"."provider_reference" is not null),
	CONSTRAINT "payment_attempts_settled_when_final" CHECK (("payment_attempts"."status" in ('succeeded', 'refunded')) = ("payment_attempts"."settled_at" is not null)),
	CONSTRAINT "payment_attempts_failure_has_reason" CHECK ("payment_attempts"."status" <> 'failed' or "payment_attempts"."failure_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"title" text,
	"body" text,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"moderated_by_user_id" uuid,
	"moderated_at" timestamp with time zone,
	CONSTRAINT "reviews_booking_key" UNIQUE("booking_id"),
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5),
	CONSTRAINT "reviews_title_length" CHECK ("reviews"."title" is null or char_length("reviews"."title") between 1 and 120),
	CONSTRAINT "reviews_body_length" CHECK ("reviews"."body" is null or char_length("reviews"."body") <= 4000)
);
--> statement-breakpoint
CREATE TABLE "resource_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"booking_id" uuid,
	"quantity" smallint NOT NULL,
	"status" "allocation_status" DEFAULT 'held' NOT NULL,
	"allocated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_allocations_quantity_positive" CHECK ("resource_allocations"."quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "staff_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"role" "assignment_role" DEFAULT 'lead' NOT NULL,
	"status" "assignment_status" DEFAULT 'assigned' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_assignments_slot_staff_key" UNIQUE("slot_id","staff_id")
);
--> statement-breakpoint
CREATE TABLE "itinerary_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"party_size" smallint NOT NULL,
	"booking_id" uuid,
	"note" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "itinerary_items_plan_slot_key" UNIQUE("plan_id","slot_id"),
	CONSTRAINT "itinerary_items_party_size_range" CHECK ("itinerary_items"."party_size" between 1 and 100),
	CONSTRAINT "itinerary_items_note_length" CHECK ("itinerary_items"."note" is null or char_length("itinerary_items"."note") <= 300)
);
--> statement-breakpoint
CREATE TABLE "itinerary_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"name" text DEFAULT 'My stay' NOT NULL,
	"arrival_date" date,
	"departure_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "itinerary_plans_name_length" CHECK (char_length("itinerary_plans"."name") between 1 and 80),
	CONSTRAINT "itinerary_plans_stay_range" CHECK ("itinerary_plans"."arrival_date" is null or "itinerary_plans"."departure_date" is null or ("itinerary_plans"."departure_date" >= "itinerary_plans"."arrival_date" and "itinerary_plans"."departure_date" - "itinerary_plans"."arrival_date" <= 21))
);
--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_profiles" ADD CONSTRAINT "guest_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_interests" ADD CONSTRAINT "guest_interests_guest_id_guest_profiles_user_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guest_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_interests" ADD CONSTRAINT "guest_interests_interest_id_interests_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."interests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_preferences" ADD CONSTRAINT "guest_preferences_guest_id_guest_profiles_user_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guest_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_preferred_times" ADD CONSTRAINT "guest_preferred_times_guest_id_guest_profiles_user_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guest_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blackout_periods" ADD CONSTRAINT "blackout_periods_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blackout_periods" ADD CONSTRAINT "blackout_periods_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_highlights" ADD CONSTRAINT "experience_highlights_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_interests" ADD CONSTRAINT "experience_interests_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_interests" ADD CONSTRAINT "experience_interests_interest_id_interests_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."interests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_slots" ADD CONSTRAINT "experience_slots_experience_id_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_category_id_experience_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."experience_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_resource_requirements" ADD CONSTRAINT "experience_resource_requirements_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_resource_requirements" ADD CONSTRAINT "experience_resource_requirements_experience_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_maintenance" ADD CONSTRAINT "resource_maintenance_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_id_guest_profiles_user_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guest_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_experience_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."experience_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_recorded_by_staff_id_staff_members_id_fk" FOREIGN KEY ("recorded_by_staff_id") REFERENCES "public"."staff_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_user_id_users_id_fk" FOREIGN KEY ("moderated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_slot_id_experience_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."experience_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_slot_id_experience_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."experience_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD CONSTRAINT "staff_assignments_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_plan_id_itinerary_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."itinerary_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_slot_id_experience_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."experience_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itinerary_plans" ADD CONSTRAINT "itinerary_plans_guest_id_guest_profiles_user_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guest_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "guest_interests_interest_idx" ON "guest_interests" USING btree ("interest_id");--> statement-breakpoint
CREATE INDEX "blackout_periods_experience_start_idx" ON "blackout_periods" USING btree ("experience_id","starts_at");--> statement-breakpoint
CREATE INDEX "experience_interests_interest_idx" ON "experience_interests" USING btree ("interest_id");--> statement-breakpoint
CREATE INDEX "experience_slots_starts_at_idx" ON "experience_slots" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "experience_slots_open_idx" ON "experience_slots" USING btree ("starts_at") WHERE status = 'scheduled';--> statement-breakpoint
CREATE INDEX "experience_slots_during_gist" ON "experience_slots" USING gist ("during");--> statement-breakpoint
CREATE INDEX "experiences_category_status_idx" ON "experiences" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "experiences_supplier_idx" ON "experiences" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "experience_resource_requirements_resource_idx" ON "experience_resource_requirements" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resource_maintenance_resource_start_idx" ON "resource_maintenance" USING btree ("resource_id","starts_at");--> statement-breakpoint
CREATE INDEX "resources_supplier_idx" ON "resources" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "booking_status_history_booking_idx" ON "booking_status_history" USING btree ("booking_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_one_active_per_guest_slot" ON "bookings" USING btree ("guest_id","slot_id") WHERE status in ('pending', 'confirmed');--> statement-breakpoint
CREATE INDEX "bookings_slot_status_idx" ON "bookings" USING btree ("slot_id","status");--> statement-breakpoint
CREATE INDEX "bookings_guest_created_idx" ON "bookings" USING btree ("guest_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_attempts_booking_idx" ON "payment_attempts" USING btree ("booking_id","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_one_success_per_booking" ON "payment_attempts" USING btree ("booking_id") WHERE status = 'succeeded';--> statement-breakpoint
CREATE INDEX "reviews_status_created_idx" ON "reviews" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "resource_allocations_resource_idx" ON "resource_allocations" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resource_allocations_slot_idx" ON "resource_allocations" USING btree ("slot_id");--> statement-breakpoint
CREATE INDEX "resource_allocations_booking_idx" ON "resource_allocations" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_allocations_one_session_hold" ON "resource_allocations" USING btree ("resource_id","slot_id") WHERE booking_id is null and status = 'held';--> statement-breakpoint
CREATE UNIQUE INDEX "staff_assignments_one_lead_per_slot" ON "staff_assignments" USING btree ("slot_id") WHERE role = 'lead' and status = 'assigned';--> statement-breakpoint
CREATE INDEX "staff_assignments_staff_idx" ON "staff_assignments" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "itinerary_items_slot_idx" ON "itinerary_items" USING btree ("slot_id");--> statement-breakpoint
CREATE INDEX "itinerary_items_booking_idx" ON "itinerary_items" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "itinerary_plans_guest_idx" ON "itinerary_plans" USING btree ("guest_id");