import { z } from "zod";

import type { EventDraftRow, MessageRow } from "../../database/schemas";
import {
  eventDraftIdSchema,
  updateEventDraftInputSchema,
} from "../../events/event-drafts.types";
import { isValidTimeZone } from "../../utils";

const localDateTimeSchema = z.iso
  .datetime({ local: true, precision: 0 })
  .refine((value) => !value.endsWith("Z"), {
    message: "Event datetime must not include timezone information.",
  });

const eventCandidateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .describe("A meaningful Event title supported by the user, or null when missing."),
    startAt: localDateTimeSchema
      .nullable()
      .describe(
        "Local start in YYYY-MM-DDTHH:mm:ss format. Return null when the user provides a date but no explicit time. Never infer 00:00 from a date-only expression.",
      ),
    endAt: localDateTimeSchema
      .nullable()
      .describe("Local end in YYYY-MM-DDTHH:mm:ss format, or null when missing."),
    timezone: z
      .string()
      .trim()
      .min(1)
      .refine(isValidTimeZone)
      .nullable()
      .describe("An explicit IANA timezone, or null to use the backend default."),
    location: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .describe("A location supported by the user, or null when missing."),
    description: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .describe("Additional supported Event details, or null when missing."),
  })
  .strict()
  .refine(
    (event) => event.endAt === null || event.startAt === null || event.endAt >= event.startAt,
    {
      message: "Event end must not be before its start.",
      path: ["endAt"],
    },
  );

export const eventAgentRunInputSchema = z
  .object({
    content: z.string().trim().min(1, { message: "Content is required" }),
    sourceMessageId: z.uuid(),
    currentDateTime: z.iso.datetime({ offset: true }),
    userTimezone: z.string().trim().min(1).refine(isValidTimeZone, {
      message: "Invalid timezone",
    }),
    history: z.array(z.custom<MessageRow>()),
  })
  .strict();

export const createEventDraftToolInputSchema = eventCandidateSchema;

export const updateEventDraftToolInputSchema = z
  .object({
    draftId: eventDraftIdSchema,
    changes: updateEventDraftInputSchema,
  })
  .strict();

export const eventAgentResponseSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1)
      .regex(/\S/, "Message must contain non-whitespace content.")
      .describe("The concise user-facing reply for this Agent run."),
  })
  .strict()
  .meta({
    title: "event_agent_response",
    description: "The final user-facing response produced by the Event Agent.",
  });

export type EventAgentRunInput = z.infer<typeof eventAgentRunInputSchema>;

export type EventAgentRunResult =
  | {
      kind: "event_card";
      eventCardMessage: MessageRow;
      clarification: string | null;
    }
  | {
      kind: "text";
      response: string;
    };

export interface EventAgentDraftMutation {
  draft: EventDraftRow;
  eventCardMessage: MessageRow;
}
