import type { MessageRow } from "../database/schemas";
import {
  eventCardPayloadSchema,
  type EventCardMessageResponse,
  type MessageResponse,
  type TextMessageResponse,
} from "./messages.types";

export function toTextMessageResponse(message: MessageRow): TextMessageResponse {
  if (message.kind !== "text" || message.content === null || message.payload !== null) {
    throw new Error("Invalid Text Message shape.");
  }

  return {
    id: message.id,
    role: message.role,
    kind: "text",
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toEventCardMessageResponse(message: MessageRow): EventCardMessageResponse {
  if (message.kind !== "event_card" || message.role !== "assistant" || message.content !== null) {
    throw new Error("Invalid Event Card Message shape.");
  }

  const payload = eventCardPayloadSchema.parse(message.payload);

  return {
    id: message.id,
    role: "assistant",
    kind: "event_card",
    payload,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toMessageResponse(message: MessageRow): MessageResponse {
  switch (message.kind) {
    case "text":
      return toTextMessageResponse(message);
    case "event_card":
      return toEventCardMessageResponse(message);
  }
}
