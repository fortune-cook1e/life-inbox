CREATE TYPE "public"."event_time_precision" AS ENUM('DATE_ONLY', 'DATE_TIME');--> statement-breakpoint
ALTER TYPE "public"."pending_question_field" ADD VALUE 'endAt' BEFORE 'timeZone';--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_ready_fields_check";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "start_at_precision" "event_time_precision";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "end_at_precision" "event_time_precision";--> statement-breakpoint
UPDATE "events" SET "start_at_precision" = 'DATE_TIME' WHERE "start_at" IS NOT NULL;--> statement-breakpoint
UPDATE "events" SET "end_at_precision" = 'DATE_TIME' WHERE "end_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_start_at_precision_check" CHECK (("events"."start_at" IS NULL AND "events"."start_at_precision" IS NULL)
        OR ("events"."start_at" IS NOT NULL AND "events"."start_at_precision" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_end_at_precision_check" CHECK (("events"."end_at" IS NULL AND "events"."end_at_precision" IS NULL)
        OR ("events"."end_at" IS NOT NULL AND "events"."end_at_precision" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_ready_fields_check" CHECK ("events"."status" = 'COLLECTING'
        OR (
          "events"."title" IS NOT NULL
          AND "events"."start_at" IS NOT NULL
          AND "events"."start_at_precision" = 'DATE_TIME'
          AND ("events"."end_at" IS NULL OR "events"."end_at_precision" = 'DATE_TIME')
          AND "events"."time_zone" IS NOT NULL
        ));
