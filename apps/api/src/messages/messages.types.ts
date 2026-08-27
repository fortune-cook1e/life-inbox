import type { MessageRow } from "../database/schemas";
import type {
  EventCardMessageResponse,
  EventConfirmMessageResponse,
  EventEditMessageResponse,
  EventRejectMessageResponse,
} from "../events/event-drafts.types";

export interface CreateMessageInput {
  content: string;
  timezone: string;
}

export interface TextMessageResponse {
  id: string;
  role: "user" | "assistant";
  kind: "text";
  content: string;
  createdAt: string;
}

export type MessageResponse =
  | TextMessageResponse
  | EventCardMessageResponse
  | EventEditMessageResponse
  | EventConfirmMessageResponse
  | EventRejectMessageResponse;

export type AssistantTurnMessageResponse =
  (TextMessageResponse & { role: "assistant" }) | EventCardMessageResponse;

export interface MessageTurn {
  userMessage: MessageRow;
  assistantMessage: MessageRow;
}

export interface MessageTurnResponse {
  userMessage: TextMessageResponse & { role: "user" };
  assistantMessage: AssistantTurnMessageResponse;
}
