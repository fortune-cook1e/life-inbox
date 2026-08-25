import { sql } from "drizzle-orm";

import { bigint, check, pgEnum, pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

export const messageKindEnum = pgEnum("message_kind", ["text", "event_card"]);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sequence: bigint("sequence", {
      mode: "number",
    })
      .generatedAlwaysAsIdentity()
      .unique("messages_sequence_unique"),

    role: messageRoleEnum("role").notNull(),
    kind: messageKindEnum("kind").default("text").notNull(),

    content: text("content"),

    payload: jsonb("payload").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "messages_content_payload_shape_check",
      sql`
        (
          ${table.kind} = 'text'
          AND ${table.content} IS NOT NULL
          AND length(btrim(${table.content})) > 0
          AND ${table.payload} IS NULL
        )
        OR
        (
          ${table.kind} = 'event_card'
          AND ${table.role} = 'assistant'
          AND ${table.content} IS NULL
          AND ${table.payload} IS NOT NULL
          AND jsonb_typeof(${table.payload}) = 'object'
        )
      `,
    ),
  ],
);

export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
