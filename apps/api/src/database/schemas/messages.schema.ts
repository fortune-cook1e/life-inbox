import { sql } from "drizzle-orm";

import { bigint, check, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

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
    content: text("content").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [check("messages_content_not_empty", sql`length(btrim(${table.content})) > 0`)],
);

export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
