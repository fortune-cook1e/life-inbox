import type { InferSelectModel } from "drizzle-orm";

import { events } from "../database/schema.js";

type Event = InferSelectModel<typeof events>;
type EventResponseSource = Pick<
  Event,
  | "id"
  | "status"
  | "title"
  | "startAt"
  | "startAtPrecision"
  | "endAt"
  | "endAtPrecision"
  | "timeZone"
  | "location"
  | "version"
>;

export type EventResponse = EventResponseSource;

export function toEventResponse(event: EventResponseSource): EventResponse {
  return {
    id: event.id,
    status: event.status,
    title: event.title,
    startAt: event.startAt,
    startAtPrecision: event.startAtPrecision,
    endAt: event.endAt,
    endAtPrecision: event.endAtPrecision,
    timeZone: event.timeZone,
    location: event.location,
    version: event.version,
  };
}
