CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_draft_id" uuid NOT NULL,
	"title" text NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp,
	"timezone" text NOT NULL,
	"location" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_source_draft_id_unique" UNIQUE("source_draft_id"),
	CONSTRAINT "events_title_not_blank_check" CHECK (length(btrim("events"."title")) > 0),
	CONSTRAINT "events_timezone_not_blank_check" CHECK (length(btrim("events"."timezone")) > 0),
	CONSTRAINT "events_time_order_check" CHECK ("events"."end_at" IS NULL OR "events"."end_at" >= "events"."start_at")
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_source_draft_id_event_drafts_id_fk" FOREIGN KEY ("source_draft_id") REFERENCES "public"."event_drafts"("id") ON DELETE no action ON UPDATE no action;
