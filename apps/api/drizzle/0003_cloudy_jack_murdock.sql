CREATE TYPE "public"."message_kind" AS ENUM('text', 'event_card');--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_content_not_empty";--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "kind" "message_kind" DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_content_payload_shape_check" CHECK (
        (
          "messages"."kind" = 'text'
          AND "messages"."content" IS NOT NULL
          AND length(btrim("messages"."content")) > 0
          AND "messages"."payload" IS NULL
        )
        OR
        (
          "messages"."kind" = 'event_card'
          AND "messages"."role" = 'assistant'
          AND "messages"."content" IS NULL
          AND "messages"."payload" IS NOT NULL
          AND jsonb_typeof("messages"."payload") = 'object'
        )
      );