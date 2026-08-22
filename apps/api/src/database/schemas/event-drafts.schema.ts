import { pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { messages } from "./messages.schema";

export const eventDraftStatusEnum = pgEnum("event_draft_status", [
  "pending",
  "confirmed",
  "rejected",
]);

export const eventDrafts = pgTable(
  "event_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sourceMessageId: uuid("source_message_id")
      .notNull()
      .references(() => messages.id),

    status: eventDraftStatusEnum("status").default("pending").notNull(),

    title: text("title"),

    startAt: timestamp("start_at", {
      withTimezone: false,
      mode: "string",
    }),

    endAt: timestamp("end_at", {
      withTimezone: false,
      mode: "string",
    }),

    timezone: text("timezone").notNull(),

    location: text("location"),

    description: text("description"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique("event_drafts_source_message_id_unique").on(table.sourceMessageId)],
);

export type EventDraftRow = typeof eventDrafts.$inferSelect;
export type NewEventDraftRow = typeof eventDrafts.$inferInsert;
