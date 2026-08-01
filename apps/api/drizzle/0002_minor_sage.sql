ALTER TABLE "events" ADD COLUMN "end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_location_not_blank_check" CHECK ("events"."location" IS NULL OR length(btrim("events"."location")) > 0);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_time_range_check" CHECK ("events"."end_at" IS NULL
        OR ("events"."start_at" IS NOT NULL AND "events"."end_at" > "events"."start_at"));