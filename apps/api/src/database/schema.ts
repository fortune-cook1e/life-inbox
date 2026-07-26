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
