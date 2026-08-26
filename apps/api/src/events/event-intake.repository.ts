import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";
import { eventDrafts, messages, type EventDraftRow, type MessageRow } from "../database/schemas";
import { eventCardPayloadSchema } from "../messages/messages.types";
import type { CreateEventDraftRecord } from "./event-drafts.repository";
import { normalizeLocalDateTime } from "../utils/utils";

export interface EventIntakeResult {
  draft: EventDraftRow;
  eventCardMessage: MessageRow;
}

@Injectable()
export class EventIntakeRepository {
  constructor(private readonly database: DatabaseService) {}

  async createPendingDraftWithInitialCard(
    input: CreateEventDraftRecord,
  ): Promise<EventIntakeResult> {
    return this.database.db.transaction(async (transaction) => {
      const [draft] = await transaction.insert(eventDrafts).values(input).returning();

      if (draft === undefined) {
        throw new Error("Event Draft insert returned no row.");
      }

      const payload = eventCardPayloadSchema.parse({
        draftId: draft.id,
        title: draft.title,
        startAt: normalizeLocalDateTime(draft.startAt),
        endAt: normalizeLocalDateTime(draft.endAt),
        timezone: draft.timezone,
        location: draft.location,
        description: draft.description,
      });

      const [eventCardMessage] = await transaction
        .insert(messages)
        .values({
          role: "assistant",
          kind: "event_card",
          content: null,
          payload,
        })
        .returning();

      if (eventCardMessage === undefined) {
        throw new Error("Event Card Message insert returned no row.");
      }

      return {
        draft,
        eventCardMessage,
      };
    });
  }
}
