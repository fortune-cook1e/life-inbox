import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";
import { eventDrafts, messages } from "../database/schemas";
import { toEventDraftValues } from "./event-drafts.mapper";
import {
  eventCardPayloadSchema,
  type CreatePendingEventDraftRecord,
  type PendingEventDraftCreationResult,
} from "./event-drafts.types";

@Injectable()
export class EventDraftIntakeRepository {
  constructor(private readonly database: DatabaseService) {}

  async createPendingDraftWithInitialCard(
    input: CreatePendingEventDraftRecord,
  ): Promise<PendingEventDraftCreationResult> {
    return this.database.db.transaction(async (transaction) => {
      const [draft] = await transaction
        .insert(eventDrafts)
        .values({
          ...input,
          status: "pending",
        })
        .returning();

      if (draft === undefined) {
        throw new Error("Event Draft insert returned no row.");
      }

      const payload = eventCardPayloadSchema.parse({
        draftId: draft.id,
        ...toEventDraftValues(draft),
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
