import { z } from "zod";

import type { EventDraftRow, EventRow, MessageRow, NewEventDraftRow } from "../database/schemas";
import { isValidTimeZone } from "../utils/time";

const localDateTimeSchema = z.iso
  .datetime({
    local: true,
    precision: 0,
  })
  .refine((value) => !value.endsWith("Z"), {
    message: "Event datetime must not include timezone information.",
  });

export const eventDraftIdSchema = z.uuid();

export const eventCardPayloadSchema = z
  .object({
    draftId: eventDraftIdSchema,
    title: z.string().nullable(),
    startAt: localDateTimeSchema.nullable(),
    endAt: localDateTimeSchema.nullable(),
    timezone: z.string().trim().min(1).refine(isValidTimeZone, {
      message: "Invalid Event Card timezone.",
    }),
    location: z.string().nullable(),
    description: z.string().nullable(),
  })
  .strict();

export type EventCardPayload = z.infer<typeof eventCardPayloadSchema>;

export const eventEditPayloadSchema = eventCardPayloadSchema;

export type EventEditPayload = z.infer<typeof eventEditPayloadSchema>;

export const eventConfirmPayloadSchema = z
  .object({
    draftId: eventDraftIdSchema,
    eventId: z.uuid(),
  })
  .strict();

export type EventConfirmPayload = z.infer<typeof eventConfirmPayloadSchema>;

export const eventRejectPayloadSchema = z
  .object({
    draftId: eventDraftIdSchema,
  })
  .strict();

export type EventRejectPayload = z.infer<typeof eventRejectPayloadSchema>;

export interface EventCardMessageResponse {
  id: string;
  role: "assistant";
  kind: "event_card";
  payload: EventCardPayload;
  createdAt: string;
}

export interface EventEditMessageResponse {
  id: string;
  role: "user";
  kind: "event_edit";
  payload: EventEditPayload;
  createdAt: string;
}

export interface EventConfirmMessageResponse {
  id: string;
  role: "user";
  kind: "event_confirm";
  payload: EventConfirmPayload;
  createdAt: string;
}

export interface EventRejectMessageResponse {
  id: string;
  role: "user";
  kind: "event_reject";
  payload: EventRejectPayload;
  createdAt: string;
}

export interface EventCancellationMessageResponse {
  id: string;
  role: "assistant";
  kind: "text";
  content: string;
  createdAt: string;
}

export type EventDraftRejectionResponse = [
  eventReject: EventRejectMessageResponse,
  cancellation: EventCancellationMessageResponse,
];

export const createPendingEventDraftInputSchema = z
  .object({
    sourceMessageId: z.uuid(),
    defaultTimezone: z.string().trim().min(1),
    event: z
      .object({
        title: z.string().nullable(),
        startAt: localDateTimeSchema.nullable(),
        endAt: localDateTimeSchema.nullable(),
        timezone: z.string().trim().min(1).nullable(),
        location: z.string().nullable(),
        description: z.string().nullable(),
      })
      .strict(),
  })
  .strict();

export type CreatePendingEventDraftInput = z.input<typeof createPendingEventDraftInputSchema>;

export type CreatePendingEventDraftRecord = Pick<
  NewEventDraftRow,
  "sourceMessageId" | "title" | "startAt" | "endAt" | "timezone" | "location" | "description"
>;

export const updateEventDraftInputSchema = z
  .object({
    title: z.string().trim().min(1).nullable().optional(),
    startAt: localDateTimeSchema.nullable().optional(),
    endAt: localDateTimeSchema.nullable().optional(),
    timezone: z
      .string()
      .trim()
      .min(1)
      .refine(isValidTimeZone, {
        message: "Invalid Event Draft timezone.",
      })
      .optional(),
    location: z.string().trim().min(1).nullable().optional(),
    description: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one Event Draft field is required.",
  });

export type UpdateEventDraftInput = z.infer<typeof updateEventDraftInputSchema>;

export const editableEventDraftSchema = z
  .object({
    title: z.string().trim().min(1).nullable(),
    startAt: localDateTimeSchema.nullable(),
    endAt: localDateTimeSchema.nullable(),
    timezone: z.string().trim().min(1).refine(isValidTimeZone, {
      message: "Invalid Event Draft timezone.",
    }),
    location: z.string().trim().min(1).nullable(),
    description: z.string().trim().min(1).nullable(),
  })
  .strict()
  .refine(
    (draft) => draft.endAt === null || draft.startAt === null || draft.endAt >= draft.startAt,
    {
      message: "Event Draft end must not be before its start.",
      path: ["endAt"],
    },
  );

export const confirmableEventSchema = z
  .object({
    title: z.string().trim().min(1),
    startAt: localDateTimeSchema,
    endAt: localDateTimeSchema.nullable(),
    timezone: z.string().trim().min(1).refine(isValidTimeZone, {
      message: "Invalid Event timezone.",
    }),
    location: z.string().nullable(),
    description: z.string().nullable(),
  })
  .strict()
  .refine((event) => event.endAt === null || event.endAt >= event.startAt, {
    message: "Event end must not be before its start.",
    path: ["endAt"],
  });

export interface PendingEventDraftCreationResult {
  draft: EventDraftRow;
  eventCardMessage: MessageRow;
}

export interface IncompletePendingEventDraftContext {
  draft: EventDraftRow;
  sourceMessageContent: string;
}

export type AgentEventDraftUpdateResult =
  | {
      kind: "updated";
      draft: EventDraftRow;
      eventCardMessage: MessageRow;
    }
  | {
      kind: "invalid_draft";
    }
  | EventDraftTransitionFailure;

export type EventDraftTransitionFailure =
  | {
      kind: "not_found";
    }
  | {
      kind: "status_conflict";
      currentStatus: EventDraftRow["status"];
    };

export type EventDraftEditResult =
  | {
      kind: "edited";
      draft: EventDraftRow;
      eventEditMessage: MessageRow;
    }
  | {
      kind: "invalid_draft";
    }
  | EventDraftTransitionFailure;

export type EventDraftConfirmationResult =
  | {
      kind: "confirmed";
      event: EventRow;
      eventConfirmMessage: MessageRow;
    }
  | {
      kind: "incomplete_draft";
    }
  | EventDraftTransitionFailure;

export interface EventDraftRejection {
  eventRejectMessage: MessageRow;
  cancellationMessage: MessageRow;
}

export type EventDraftRejectionResult =
  | ({
      kind: "rejected";
    } & EventDraftRejection)
  | EventDraftTransitionFailure;
