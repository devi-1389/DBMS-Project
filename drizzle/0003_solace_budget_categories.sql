CREATE TABLE "guest_preferred_categories" (
	"guest_id" uuid NOT NULL,
	"category_id" smallint NOT NULL,
	CONSTRAINT "guest_preferred_categories_pkey" PRIMARY KEY("guest_id","category_id")
);
--> statement-breakpoint
ALTER TABLE "guest_preferences" ALTER COLUMN "currency" SET DEFAULT 'INR';--> statement-breakpoint
ALTER TABLE "experiences" ALTER COLUMN "currency" SET DEFAULT 'INR';--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "currency" SET DEFAULT 'INR';--> statement-breakpoint
ALTER TABLE "payment_attempts" ALTER COLUMN "currency" SET DEFAULT 'INR';--> statement-breakpoint
ALTER TABLE "itinerary_plans" ADD COLUMN "activity_budget" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "itinerary_plans" ADD COLUMN "currency" char(3) DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_preferred_categories" ADD CONSTRAINT "guest_preferred_categories_guest_id_guest_profiles_user_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guest_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_preferred_categories" ADD CONSTRAINT "guest_preferred_categories_category_id_experience_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."experience_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_preferred_categories_category_idx" ON "guest_preferred_categories" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "itinerary_plans" ADD CONSTRAINT "itinerary_plans_budget_range" CHECK ("itinerary_plans"."activity_budget" is null or "itinerary_plans"."activity_budget" between 0 and 10000000);--> statement-breakpoint
ALTER TABLE "itinerary_plans" ADD CONSTRAINT "itinerary_plans_currency_format" CHECK ("itinerary_plans"."currency" ~ '^[A-Z]{3}$');