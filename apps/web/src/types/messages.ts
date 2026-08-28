export interface TextMessage {
  id: string;
  role: "user" | "assistant";
  kind: "text";
  content: string;
  createdAt: string;
}

export interface EventDraftPayload {
  draftId: string;
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  timezone: string;
  location: string | null;
  description: string | null;
}

export interface EventCardMessage {
  id: string;
  role: "assistant";
  kind: "event_card";
  payload: EventDraftPayload;
  createdAt: string;
}

export interface EventEditMessage {
  id: string;
  role: "user";
  kind: "event_edit";
  payload: EventDraftPayload;
  createdAt: string;
}

export interface EventConfirmMessage {
  id: string;
  role: "user";
  kind: "event_confirm";
  payload: { draftId: string; eventId: string };
  createdAt: string;
}

export interface EventRejectMessage {
  id: string;
  role: "user";
  kind: "event_reject";
  payload: { draftId: string };
  createdAt: string;
}

export type TimelineMessage =
  TextMessage | EventCardMessage | EventEditMessage | EventConfirmMessage | EventRejectMessage;

export interface MessageTurnResponse {
  userMessage: TextMessage & { role: "user" };
  assistantMessage: (TextMessage & { role: "assistant" }) | EventCardMessage;
}

export interface SendMessageInput {
  content: string;
  timezone: string;
}

export type UpdateEventDraftInput = Omit<EventDraftPayload, "draftId">;
