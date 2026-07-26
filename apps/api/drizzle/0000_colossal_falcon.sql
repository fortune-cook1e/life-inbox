CREATE TYPE "public"."chat_message_kind" AS ENUM('USER_TEXT', 'SOURCE_SUBMITTED', 'CLARIFICATION_QUESTION', 'CLARIFICATION_ANSWER', 'EVENT_EDIT', 'DRAFT_PROGRESS', 'EVENT_PREVIEW', 'EVENT_CONFIRMED', 'EVENT_UPDATE_PREVIEW', 'EVENT_CANCELLATION_PREVIEW', 'EVENT_QUERY_RESULT', 'STATUS');--> statement-breakpoint
CREATE TYPE "public"."chat_message_role" AS ENUM('USER', 'ASSISTANT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."life_case_resolution" AS ENUM('EVENT_CONFIRMED', 'EVENT_IGNORED', 'NO_ACTION', 'EVENT_CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."life_case_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid,
	"role" "chat_message_role" NOT NULL,
	"kind" "chat_message_kind" NOT NULL,
	"content" text NOT NULL,
	"client_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_content_not_blank_check" CHECK (length(btrim("chat_messages"."content")) > 0)
);
--> statement-breakpoint
CREATE TABLE "life_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "life_case_status" DEFAULT 'OPEN' NOT NULL,
	"resolution" "life_case_resolution",
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "life_cases_status_resolution_check" CHECK (("life_cases"."status" = 'OPEN' AND "life_cases"."resolution" IS NULL)
        OR ("life_cases"."status" = 'CLOSED' AND "life_cases"."resolution" IS NOT NULL)),
	CONSTRAINT "life_cases_version_positive_check" CHECK ("life_cases"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_case_id_life_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."life_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_client_message_id_unique" ON "chat_messages" USING btree ("client_message_id");--> statement-breakpoint
CREATE INDEX "chat_messages_timeline_idx" ON "chat_messages" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "chat_messages_case_timeline_idx" ON "chat_messages" USING btree ("case_id","created_at","id");