import { Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";

import { DatabaseService } from "../database/database.service.js";
import { chatMessages, events, lifeCases } from "../database/schema.js";
import {
  evaluateEventCandidate,
  getMissingRequiredEventFields,
  type RequiredEventField,
} from "../events/event-readiness.js";

export interface CalendarEventProposal {
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  timeZone: string | null;
  location: string | null;
}

@Injectable()
export class AgentToolsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createCaseForMessage(inputMessageId: string) {
    return this.databaseService.db.transaction(async (transaction) => {
      const [message] = await transaction
        .select({ id: chatMessages.id, caseId: chatMessages.caseId })
        .from(chatMessages)
        .where(eq(chatMessages.id, inputMessageId))
        .for("update")
        .limit(1);

      if (!message) {
        return {
          ok: false as const,
          reason: "INPUT_MESSAGE_NOT_FOUND" as const,
        };
      }

      if (message.caseId) {
        return {
          ok: true as const,
          caseId: message.caseId,
        };
      }

      const [lifeCase] = await transaction.insert(lifeCases).values({}).returning();

      if (!lifeCase) {
        throw new Error("Creating a LifeCase did not return a row.");
      }

      const [updatedMessage] = await transaction
        .update(chatMessages)
        .set({ caseId: lifeCase.id })
        .where(and(eq(chatMessages.id, inputMessageId), sql`${chatMessages.caseId} is null`))
        .returning({ id: chatMessages.id });

      if (!updatedMessage) {
        throw new Error("Binding the input ChatMessage to its LifeCase did not return a row.");
      }

      return {
        ok: true as const,
        caseId: lifeCase.id,
      };
    });
  }

  async proposeCalendarEvent(
    caseId: string,
    proposal: CalendarEventProposal,
    defaultTimeZone: string,
  ) {
    const evaluation = evaluateEventCandidate({
      title: proposal.title,
      startAt: toDate(proposal.startAt),
      endAt: toDate(proposal.endAt),
      timeZone: proposal.timeZone ?? defaultTimeZone,
      location: proposal.location,
    });

    if (!evaluation.valid) {
      return {
        ok: false as const,
        reason: "INVALID_EVENT" as const,
        issues: evaluation.issues,
      };
    }

    const [insertedEvent] = await this.databaseService.db
      .insert(events)
      .values({
        caseId,
        status: evaluation.status,
        ...evaluation.candidate,
      })
      .onConflictDoNothing({ target: events.caseId })
      .returning();

    const event = insertedEvent ?? (await this.findEventByCaseId(caseId));

    if (!event) {
      throw new Error("Creating or loading an Event did not return a row.");
    }

    const storedEvaluation = evaluateEventCandidate(event);

    if (!storedEvaluation.valid) {
      throw new Error("The stored Event failed backend validation.");
    }

    return {
      ok: true as const,
      event,
      status: storedEvaluation.status,
      missingFields: getMissingRequiredEventFields(storedEvaluation.candidate),
    };
  }

  async askUser(caseId: string, eventId: string, field: RequiredEventField, question: string) {
    const normalizedQuestion = question.trim();

    if (!normalizedQuestion) {
      return {
        ok: false as const,
        reason: "QUESTION_NOT_BLANK" as const,
      };
    }

    return this.databaseService.db.transaction(async (transaction) => {
      const [event] = await transaction
        .select()
        .from(events)
        .where(and(eq(events.id, eventId), eq(events.caseId, caseId)))
        .for("update")
        .limit(1);

      if (!event) {
        return {
          ok: false as const,
          reason: "EVENT_NOT_FOUND" as const,
        };
      }

      const evaluation = evaluateEventCandidate(event);

      if (!evaluation.valid) {
        return {
          ok: false as const,
          reason: "INVALID_EVENT" as const,
          issues: evaluation.issues,
        };
      }

      const missingFields = getMissingRequiredEventFields(evaluation.candidate);

      if (!missingFields.includes(field)) {
        return {
          ok: false as const,
          reason: "FIELD_DOES_NOT_NEED_CLARIFICATION" as const,
          missingFields,
        };
      }

      const [assistantMessage] = await transaction
        .insert(chatMessages)
        .values({
          caseId,
          role: "ASSISTANT",
          kind: "CLARIFICATION_QUESTION",
          content: normalizedQuestion,
        })
        .returning();

      if (!assistantMessage) {
        throw new Error("Creating a clarification ChatMessage did not return a row.");
      }

      return {
        ok: true as const,
        outcome: { event, assistantMessage },
      };
    });
  }

  async showEventPreview(caseId: string, eventId: string, message: string) {
    const normalizedMessage = message.trim();

    if (!normalizedMessage) {
      return {
        ok: false as const,
        reason: "MESSAGE_NOT_BLANK" as const,
      };
    }

    return this.databaseService.db.transaction(async (transaction) => {
      const [event] = await transaction
        .select()
        .from(events)
        .where(and(eq(events.id, eventId), eq(events.caseId, caseId)))
        .for("update")
        .limit(1);

      if (!event) {
        return {
          ok: false as const,
          reason: "EVENT_NOT_FOUND" as const,
        };
      }

      const evaluation = evaluateEventCandidate(event);

      if (!evaluation.valid) {
        return {
          ok: false as const,
          reason: "INVALID_EVENT" as const,
          issues: evaluation.issues,
        };
      }

      const missingFields = getMissingRequiredEventFields(evaluation.candidate);

      if (evaluation.status !== "READY") {
        return {
          ok: false as const,
          reason: "EVENT_NOT_READY" as const,
          missingFields,
        };
      }

      const [assistantMessage] = await transaction
        .insert(chatMessages)
        .values({
          caseId,
          role: "ASSISTANT",
          kind: "EVENT_PREVIEW",
          content: normalizedMessage,
        })
        .returning();

      if (!assistantMessage) {
        throw new Error("Creating an Event Preview ChatMessage did not return a row.");
      }

      return {
        ok: true as const,
        outcome: { event, assistantMessage },
      };
    });
  }

  private async findEventByCaseId(caseId: string) {
    const [event] = await this.databaseService.db
      .select()
      .from(events)
      .where(eq(events.caseId, caseId))
      .limit(1);

    return event;
  }
}

function toDate(value: string | null) {
  return value === null ? null : new Date(value);
}
