import type { EventDraftPayload, TimelineMessage } from "../types/messages";

export type EventDraftStatus = "pending" | "confirmed" | "rejected";

export interface EventDraftTimelineState {
  latestSnapshotId: string;
  payload: EventDraftPayload;
  status: EventDraftStatus;
  eventId?: string;
}

export function buildEventDraftStates(messages: TimelineMessage[]) {
  const states: Record<string, EventDraftTimelineState> = {};

  for (const message of messages) {
    if (message.kind === "event_card" || message.kind === "event_edit") {
      const current = states[message.payload.draftId];
      states[message.payload.draftId] = {
        latestSnapshotId: message.id,
        payload: message.payload,
        status: current?.status ?? "pending",
        ...(current?.eventId ? { eventId: current.eventId } : {}),
      };
      continue;
    }

    if (message.kind === "event_confirm") {
      const current = states[message.payload.draftId];
      if (current) {
        states[message.payload.draftId] = {
          ...current,
          status: "confirmed",
          eventId: message.payload.eventId,
        };
      }
      continue;
    }

    if (message.kind === "event_reject") {
      const current = states[message.payload.draftId];
      if (current) {
        states[message.payload.draftId] = { ...current, status: "rejected" };
      }
    }
  }

  return states;
}
