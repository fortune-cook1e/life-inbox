import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { eventDrafts } from "./event-drafts.schema";

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sourceDraftId: uuid("source_draft_id")
      .notNull()
      .references(() => eventDrafts.id),

    title: text("title").notNull(),

    startAt: timestamp("start_at", {
      withTimezone: false,
      mode: "string",
    }).notNull(),

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
  },
  (table) => [
    unique("events_source_draft_id_unique").on(table.sourceDraftId),
    check("events_title_not_blank_check", sql`length(btrim(${table.title})) > 0`),
    check("events_timezone_not_blank_check", sql`length(btrim(${table.timezone})) > 0`),
    check(
      "events_time_order_check",
      sql`${table.endAt} IS NULL OR ${table.endAt} >= ${table.startAt}`,
    ),
  ],
);

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
