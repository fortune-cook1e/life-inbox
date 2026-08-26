import type { MessageRow } from "../database/schemas";
import {
  toEventCardMessageResponse,
  toEventConfirmMessageResponse,
  toEventEditMessageResponse,
  toEventRejectMessageResponse,
} from "../events/event-drafts.mapper";
import {
  type AssistantTurnMessageResponse,
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

export function toUserTextMessageResponse(
  message: MessageRow,
): TextMessageResponse & { role: "user" } {
  const response = toTextMessageResponse(message);

  if (response.role !== "user") {
    throw new Error("Expected a user Text Message.");
  }

  return response as TextMessageResponse & { role: "user" };
}

export function toAssistantTurnMessageResponse(message: MessageRow): AssistantTurnMessageResponse {
  if (message.kind === "event_card") {
    return toEventCardMessageResponse(message);
  }

  const response = toTextMessageResponse(message);

  if (response.role !== "assistant") {
    throw new Error("Expected an assistant turn Message.");
  }

  return response as TextMessageResponse & { role: "assistant" };
}

export function toMessageResponse(message: MessageRow): MessageResponse {
  switch (message.kind) {
    case "text":
      return toTextMessageResponse(message);
    case "event_card":
      return toEventCardMessageResponse(message);
    case "event_edit":
      return toEventEditMessageResponse(message);
    case "event_confirm":
      return toEventConfirmMessageResponse(message);
    case "event_reject":
      return toEventRejectMessageResponse(message);
  }
}
