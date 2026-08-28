import { Injectable } from "@nestjs/common";
import { and, desc, eq, isNull, or } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { eventDrafts, messages } from "../database/schemas";
import { toEventDraftValues } from "./event-drafts.mapper";
import {
  editableEventDraftSchema,
  eventCardPayloadSchema,
  type AgentEventDraftUpdateResult,
  type IncompletePendingEventDraftContext,
  type UpdateEventDraftInput,
} from "./event-drafts.types";

const EVENT_AGENT_DRAFT_CONTEXT_LIMIT = 10;

@Injectable()
export class EventDraftAgentRepository {
  constructor(private readonly database: DatabaseService) {}

  async findIncompletePendingDraftContexts(): Promise<IncompletePendingEventDraftContext[]> {
    const rows = await this.database.db
      .select({
        draft: eventDrafts,
        sourceMessageContent: messages.content,
      })
      .from(eventDrafts)
      .innerJoin(messages, eq(messages.id, eventDrafts.sourceMessageId))
      .where(
        and(
          eq(eventDrafts.status, "pending"),
          or(isNull(eventDrafts.title), isNull(eventDrafts.startAt)),
        ),
      )
      .orderBy(desc(eventDrafts.createdAt))
      .limit(EVENT_AGENT_DRAFT_CONTEXT_LIMIT);

    return rows.reverse().map(({ draft, sourceMessageContent }) => {
      if (sourceMessageContent === null) {
        throw new Error("Event Draft source Message has no text content.");
      }

      return {
        draft,
        sourceMessageContent,
      };
    });
  }

  async updatePendingDraftWithEventCard(
    draftId: string,
    changes: UpdateEventDraftInput,
  ): Promise<AgentEventDraftUpdateResult> {
    return this.database.db.transaction(async (transaction) => {
      const [draft] = await transaction
        .select()
        .from(eventDrafts)
        .where(eq(eventDrafts.id, draftId))
        .limit(1)
        .for("update");

      if (draft === undefined) {
        return { kind: "not_found" };
      }

      if (draft.status !== "pending") {
        return {
          kind: "status_conflict",
          currentStatus: draft.status,
        };
      }

      const candidate = editableEventDraftSchema.safeParse({
        ...toEventDraftValues(draft),
        ...changes,
      });

      if (!candidate.success) {
        return { kind: "invalid_draft" };
      }

      const [updatedDraft] = await transaction
        .update(eventDrafts)
        .set({
          ...candidate.data,
          updatedAt: new Date(),
        })
        .where(eq(eventDrafts.id, draft.id))
        .returning();

      if (updatedDraft === undefined) {
        throw new Error("Event Draft Agent update returned no row.");
      }

      const payload = eventCardPayloadSchema.parse({
        draftId: updatedDraft.id,
        ...toEventDraftValues(updatedDraft),
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
        throw new Error("Event Draft Agent Event Card insert returned no row.");
      }

      return {
        kind: "updated",
        draft: updatedDraft,
        eventCardMessage,
      };
    });
  }
}
