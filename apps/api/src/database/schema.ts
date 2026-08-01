import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const lifeCaseStatus = pgEnum("life_case_status", ["OPEN", "CLOSED"]);

export const lifeCaseResolution = pgEnum("life_case_resolution", [
  "EVENT_CONFIRMED",
  "EVENT_IGNORED",
  "NO_ACTION",
  "EVENT_CANCELLED",
]);

export const chatMessageRole = pgEnum("chat_message_role", ["USER", "ASSISTANT", "SYSTEM"]);

export const chatMessageKind = pgEnum("chat_message_kind", [
  "USER_TEXT",
  "SOURCE_SUBMITTED",
  "CLARIFICATION_QUESTION",
  "CLARIFICATION_ANSWER",
  "EVENT_EDIT",
  "DRAFT_PROGRESS",
  "EVENT_PREVIEW",
  "EVENT_CONFIRMED",
  "EVENT_UPDATE_PREVIEW",
  "EVENT_CANCELLATION_PREVIEW",
  "EVENT_QUERY_RESULT",
  "STATUS",
]);

export const eventStatus = pgEnum("event_status", ["COLLECTING", "READY"]);

export const lifeCases = pgTable(
  "life_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    status: lifeCaseStatus("status").default("OPEN").notNull(),
    resolution: lifeCaseResolution("resolution"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "life_cases_status_resolution_check",
      sql`(${table.status} = 'OPEN' AND ${table.resolution} IS NULL)
        OR (${table.status} = 'CLOSED' AND ${table.resolution} IS NOT NULL)`,
    ),
    check("life_cases_version_positive_check", sql`${table.version} > 0`),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").references(() => lifeCases.id, {
      onDelete: "restrict",
    }),
    role: chatMessageRole("role").notNull(),
    kind: chatMessageKind("kind").notNull(),
    content: text("content").notNull(),
    clientMessageId: text("client_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("chat_messages_content_not_blank_check", sql`length(btrim(${table.content})) > 0`),
    uniqueIndex("chat_messages_client_message_id_unique").on(table.clientMessageId),
    index("chat_messages_timeline_idx").on(table.createdAt, table.id),
    index("chat_messages_case_timeline_idx").on(table.caseId, table.createdAt, table.id),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => lifeCases.id, {
        onDelete: "restrict",
      }),
    status: eventStatus("status").default("COLLECTING").notNull(),
    title: text("title"),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    timeZone: text("time_zone"),
    location: text("location"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("events_case_id_unique").on(table.caseId),
    check(
      "events_title_not_blank_check",
      sql`${table.title} IS NULL OR length(btrim(${table.title})) > 0`,
    ),
    check(
      "events_time_zone_not_blank_check",
      sql`${table.timeZone} IS NULL OR length(btrim(${table.timeZone})) > 0`,
    ),
    check(
      "events_location_not_blank_check",
      sql`${table.location} IS NULL OR length(btrim(${table.location})) > 0`,
    ),
    check(
      "events_time_range_check",
      sql`${table.endAt} IS NULL
        OR (${table.startAt} IS NOT NULL AND ${table.endAt} > ${table.startAt})`,
    ),
    check("events_version_positive_check", sql`${table.version} > 0`),
    check(
      "events_ready_fields_check",
      sql`${table.status} = 'COLLECTING'
        OR (
          ${table.title} IS NOT NULL
          AND ${table.startAt} IS NOT NULL
          AND ${table.timeZone} IS NOT NULL
        )`,
    ),
  ],
);
