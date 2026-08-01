CREATE TYPE "public"."event_status" AS ENUM('COLLECTING', 'READY');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"status" "event_status" DEFAULT 'COLLECTING' NOT NULL,
	"title" text,
	"start_at" timestamp with time zone,
	"time_zone" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_title_not_blank_check" CHECK ("events"."title" IS NULL OR length(btrim("events"."title")) > 0),
	CONSTRAINT "events_time_zone_not_blank_check" CHECK ("events"."time_zone" IS NULL OR length(btrim("events"."time_zone")) > 0),
	CONSTRAINT "events_version_positive_check" CHECK ("events"."version" > 0),
	CONSTRAINT "events_ready_fields_check" CHECK ("events"."status" = 'COLLECTING'
        OR (
          "events"."title" IS NOT NULL
          AND "events"."start_at" IS NOT NULL
          AND "events"."time_zone" IS NOT NULL
        ))
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_case_id_life_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."life_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "events_case_id_unique" ON "events" USING btree ("case_id");