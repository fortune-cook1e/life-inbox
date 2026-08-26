ALTER TABLE "messages"
DROP CONSTRAINT "messages_content_payload_shape_check";
--> statement-breakpoint

ALTER TYPE "public"."message_kind"
RENAME TO "message_kind_old";
--> statement-breakpoint

CREATE TYPE "public"."message_kind"
AS ENUM('text', 'event_card', 'event_edit', 'event_confirm', 'event_reject');
--> statement-breakpoint

ALTER TABLE "messages"
ALTER COLUMN "kind" DROP DEFAULT;
--> statement-breakpoint

ALTER TABLE "messages"
ALTER COLUMN "kind" TYPE "public"."message_kind"
USING "kind"::text::"public"."message_kind";
--> statement-breakpoint

ALTER TABLE "messages"
ALTER COLUMN "kind" SET DEFAULT 'text';
--> statement-breakpoint

DROP TYPE "public"."message_kind_old";
--> statement-breakpoint

ALTER TABLE "messages"
ADD CONSTRAINT "messages_content_payload_shape_check"
CHECK (
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
  OR
  (
    "messages"."kind" = 'event_edit'
    AND "messages"."role" = 'user'
    AND "messages"."content" IS NULL
    AND "messages"."payload" IS NOT NULL
    AND jsonb_typeof("messages"."payload") = 'object'
    AND "messages"."payload" ? 'draftId'
    AND jsonb_typeof("messages"."payload" -> 'draftId') = 'string'
  )
  OR
  (
    "messages"."kind" = 'event_confirm'
    AND "messages"."role" = 'user'
    AND "messages"."content" IS NULL
    AND "messages"."payload" IS NOT NULL
    AND jsonb_typeof("messages"."payload") = 'object'
    AND "messages"."payload" ? 'draftId'
    AND jsonb_typeof("messages"."payload" -> 'draftId') = 'string'
    AND "messages"."payload" ? 'eventId'
    AND jsonb_typeof("messages"."payload" -> 'eventId') = 'string'
  )
  OR
  (
    "messages"."kind" = 'event_reject'
    AND "messages"."role" = 'user'
    AND "messages"."content" IS NULL
    AND "messages"."payload" IS NOT NULL
    AND jsonb_typeof("messages"."payload") = 'object'
    AND "messages"."payload" ? 'draftId'
    AND jsonb_typeof("messages"."payload" -> 'draftId') = 'string'
  )
);
