import type { InferSelectModel } from "drizzle-orm";

import { events } from "../database/schema.js";

type Event = InferSelectModel<typeof events>;
type AgentEventSource = Pick<
  Event,
  "id" | "status" | "title" | "startAt" | "endAt" | "timeZone" | "location" | "version"
>;

export function toAgentEvent(event: AgentEventSource) {
  return {
    id: event.id,
    status: event.status,
    title: event.title,
    startAt: event.startAt?.toISOString() ?? null,
    endAt: event.endAt?.toISOString() ?? null,
    timeZone: event.timeZone,
    location: event.location,
    version: event.version,
  };
}
