import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { eventDrafts, events, messages } from "../database/schemas";
import { toEventDraftValues } from "./event-drafts.mapper";
import {
  confirmableEventSchema,
  editableEventDraftSchema,
  eventConfirmPayloadSchema,
  eventEditPayloadSchema,
  eventRejectPayloadSchema,
  type EventDraftConfirmationResult,
  type EventDraftEditResult,
  type EventDraftRejectionResult,
  type UpdateEventDraftInput,
} from "./event-drafts.types";

const cancellationContent = "Event creation was cancelled.";

@Injectable()
export class EventDraftTransitionsRepository {
  constructor(private readonly database: DatabaseService) {}

  async editPendingDraft(
    draftId: string,
    changes: UpdateEventDraftInput,
  ): Promise<EventDraftEditResult> {
    return this.database.db.transaction(async (transaction) => {
      const [draft] = await transaction
        .select()
        .from(eventDrafts)
        .where(eq(eventDrafts.id, draftId))
        .limit(1)
        .for("update");

      if (draft === undefined) {
        return {
          kind: "not_found",
        };
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
        return {
          kind: "invalid_draft",
        };
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
        throw new Error("Event Draft update returned no row.");
      }

      const payload = eventEditPayloadSchema.parse({
        draftId: updatedDraft.id,
        ...toEventDraftValues(updatedDraft),
      });

      const [eventEditMessage] = await transaction
        .insert(messages)
        .values({
          role: "user",
          kind: "event_edit",
          content: null,
          payload,
        })
        .returning();

      if (eventEditMessage === undefined) {
        throw new Error("Event Edit Message insert returned no row.");
      }

      return {
        kind: "edited",
        draft: updatedDraft,
        eventEditMessage,
      };
    });
  }

  async confirmPendingDraft(draftId: string): Promise<EventDraftConfirmationResult> {
    return this.database.db.transaction(async (transaction) => {
      const [draft] = await transaction
        .select()
        .from(eventDrafts)
        .where(eq(eventDrafts.id, draftId))
        .limit(1)
        .for("update");

      if (draft === undefined) {
        return {
          kind: "not_found",
        };
      }

      if (draft.status !== "pending") {
        return {
          kind: "status_conflict",
          currentStatus: draft.status,
        };
      }

      const confirmedValues = confirmableEventSchema.safeParse(toEventDraftValues(draft));

      if (!confirmedValues.success) {
        return {
          kind: "incomplete_draft",
        };
      }

      const [event] = await transaction
        .insert(events)
        .values({
          sourceDraftId: draft.id,
          ...confirmedValues.data,
        })
        .returning();

      if (event === undefined) {
        throw new Error("Event insert returned no row.");
      }

      const [confirmedDraft] = await transaction
        .update(eventDrafts)
        .set({
          status: "confirmed",
          updatedAt: new Date(),
        })
        .where(eq(eventDrafts.id, draft.id))
        .returning({
          id: eventDrafts.id,
        });

      if (confirmedDraft === undefined) {
        throw new Error("Event Draft confirmation returned no row.");
      }

      const payload = eventConfirmPayloadSchema.parse({
        draftId: confirmedDraft.id,
        eventId: event.id,
      });

      const [eventConfirmMessage] = await transaction
        .insert(messages)
        .values({
          role: "user",
          kind: "event_confirm",
          content: null,
          payload,
        })
        .returning();

      if (eventConfirmMessage === undefined) {
        throw new Error("Event Confirm Message insert returned no row.");
      }

      return {
        kind: "confirmed",
        event,
        eventConfirmMessage,
      };
    });
  }

  async rejectPendingDraft(draftId: string): Promise<EventDraftRejectionResult> {
    return this.database.db.transaction(async (transaction) => {
      const [draft] = await transaction
        .select()
        .from(eventDrafts)
        .where(eq(eventDrafts.id, draftId))
        .limit(1)
        .for("update");

      if (draft === undefined) {
        return {
          kind: "not_found",
        };
      }

      if (draft.status !== "pending") {
        return {
          kind: "status_conflict",
          currentStatus: draft.status,
        };
      }

      const [rejectedDraft] = await transaction
        .update(eventDrafts)
        .set({
          status: "rejected",
          updatedAt: new Date(),
        })
        .where(eq(eventDrafts.id, draft.id))
        .returning({
          id: eventDrafts.id,
        });

      if (rejectedDraft === undefined) {
        throw new Error("Event Draft rejection returned no row.");
      }

      const eventRejectPayload = eventRejectPayloadSchema.parse({
        draftId: rejectedDraft.id,
      });

      const [eventRejectMessage] = await transaction
        .insert(messages)
        .values({
          role: "user",
          kind: "event_reject",
          content: null,
          payload: eventRejectPayload,
        })
        .returning();

      if (eventRejectMessage === undefined) {
        throw new Error("Event Reject Message insert returned no row.");
      }

      const [cancellationMessage] = await transaction
        .insert(messages)
        .values({
          role: "assistant",
          kind: "text",
          content: cancellationContent,
          payload: null,
        })
        .returning();

      if (cancellationMessage === undefined) {
        throw new Error("Cancellation Message insert returned no row.");
      }

      return {
        kind: "rejected",
        eventRejectMessage,
        cancellationMessage,
      };
    });
  }
}
