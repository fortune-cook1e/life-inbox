CREATE TYPE "public"."pending_question_field" AS ENUM('title', 'startAt', 'timeZone');--> statement-breakpoint
CREATE TYPE "public"."pending_question_status" AS ENUM('OPEN', 'RESOLVED');--> statement-breakpoint
CREATE TABLE "pending_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"question_message_id" uuid NOT NULL,
	"expected_field" "pending_question_field" NOT NULL,
	"status" "pending_question_status" DEFAULT 'OPEN' NOT NULL,
	"event_version" integer NOT NULL,
	"resolved_by_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "pending_questions_event_version_positive_check" CHECK ("pending_questions"."event_version" > 0),
	CONSTRAINT "pending_questions_resolution_state_check" CHECK (("pending_questions"."status" = 'OPEN'
          AND "pending_questions"."resolved_by_message_id" IS NULL
          AND "pending_questions"."resolved_at" IS NULL)
        OR ("pending_questions"."status" = 'RESOLVED'
          AND "pending_questions"."resolved_by_message_id" IS NOT NULL
          AND "pending_questions"."resolved_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "pending_questions" ADD CONSTRAINT "pending_questions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_questions" ADD CONSTRAINT "pending_questions_question_message_id_chat_messages_id_fk" FOREIGN KEY ("question_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_questions" ADD CONSTRAINT "pending_questions_resolved_by_message_id_chat_messages_id_fk" FOREIGN KEY ("resolved_by_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_questions_open_event_unique" ON "pending_questions" USING btree ("event_id") WHERE "pending_questions"."status" = 'OPEN';--> statement-breakpoint
CREATE UNIQUE INDEX "pending_questions_question_message_id_unique" ON "pending_questions" USING btree ("question_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_questions_resolved_by_message_id_unique" ON "pending_questions" USING btree ("resolved_by_message_id");--> statement-breakpoint
CREATE INDEX "pending_questions_open_created_idx" ON "pending_questions" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "pending_questions"."status" = 'OPEN';