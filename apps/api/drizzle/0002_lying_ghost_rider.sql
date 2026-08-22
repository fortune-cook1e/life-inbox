CREATE TYPE "public"."event_draft_status" AS ENUM('pending', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TABLE "event_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_message_id" uuid NOT NULL,
	"status" "event_draft_status" DEFAULT 'pending' NOT NULL,
	"title" text,
	"start_at" timestamp,
	"end_at" timestamp,
	"timezone" text NOT NULL,
	"location" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_drafts_source_message_id_unique" UNIQUE("source_message_id")
);
--> statement-breakpoint
ALTER TABLE "event_drafts" ADD CONSTRAINT "event_drafts_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;