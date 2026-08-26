import type { EventDraftRow, MessageRow } from "../database/schemas";
import { normalizeLocalDateTime } from "../common/time";
import {
  eventCardPayloadSchema,
  eventConfirmPayloadSchema,
  eventEditPayloadSchema,
  eventRejectPayloadSchema,
  type EventCancellationMessageResponse,
  type EventCardMessageResponse,
  type EventConfirmMessageResponse,
  type EventEditMessageResponse,
  type EventRejectMessageResponse,
} from "./event-drafts.types";

export function toEventDraftValues(draft: EventDraftRow) {
  return {
    title: draft.title,
    startAt: normalizeLocalDateTime(draft.startAt),
    endAt: normalizeLocalDateTime(draft.endAt),
    timezone: draft.timezone,
    location: draft.location,
    description: draft.description,
  };
}

export function toEventCardMessageResponse(message: MessageRow): EventCardMessageResponse {
  if (message.kind !== "event_card" || message.role !== "assistant" || message.content !== null) {
    throw new Error("Invalid Event Card Message shape.");
  }

  return {
    id: message.id,
    role: "assistant",
    kind: "event_card",
    payload: eventCardPayloadSchema.parse(message.payload),
    createdAt: message.createdAt.toISOString(),
  };
}

export function toEventEditMessageResponse(message: MessageRow): EventEditMessageResponse {
  if (message.kind !== "event_edit" || message.role !== "user" || message.content !== null) {
    throw new Error("Invalid Event Edit Message shape.");
  }

  return {
    id: message.id,
    role: "user",
    kind: "event_edit",
    payload: eventEditPayloadSchema.parse(message.payload),
    createdAt: message.createdAt.toISOString(),
  };
}

export function toEventConfirmMessageResponse(message: MessageRow): EventConfirmMessageResponse {
  if (message.kind !== "event_confirm" || message.role !== "user" || message.content !== null) {
    throw new Error("Invalid Event Confirm Message shape.");
  }

  return {
    id: message.id,
    role: "user",
    kind: "event_confirm",
    payload: eventConfirmPayloadSchema.parse(message.payload),
    createdAt: message.createdAt.toISOString(),
  };
}

export function toEventRejectMessageResponse(message: MessageRow): EventRejectMessageResponse {
  if (message.kind !== "event_reject" || message.role !== "user" || message.content !== null) {
    throw new Error("Invalid Event Reject Message shape.");
  }

  return {
    id: message.id,
    role: "user",
    kind: "event_reject",
    payload: eventRejectPayloadSchema.parse(message.payload),
    createdAt: message.createdAt.toISOString(),
  };
}

export function toEventCancellationMessageResponse(
  message: MessageRow,
): EventCancellationMessageResponse {
  if (
    message.kind !== "text" ||
    message.role !== "assistant" ||
    message.content === null ||
    message.payload !== null
  ) {
    throw new Error("Invalid Event cancellation Message shape.");
  }

  return {
    id: message.id,
    role: "assistant",
    kind: "text",
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}
