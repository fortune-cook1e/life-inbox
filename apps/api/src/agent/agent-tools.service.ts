import { Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { DatabaseService } from "../database/database.service.js";
import { chatMessages, events, lifeCases } from "../database/schema.js";
import {
  evaluateEventCandidate,
  getMissingRequiredEventFields,
  type RequiredEventField,
} from "../events/event-readiness.js";
import type { AgentTerminalOutcome } from "./agent.types.js";

export interface CalendarEventProposal {
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  timeZone: string | null;
  location: string | null;
}

const terminalMessageKinds = ["CLARIFICATION_QUESTION", "EVENT_PREVIEW"] as const;

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
          reused: true,
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
        reused: false,
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

    const event = await this.databaseService.db.transaction(async (transaction) => {
      const [existingEvent] = await transaction
        .select()
        .from(events)
        .where(eq(events.caseId, caseId))
        .for("update")
        .limit(1);

      if (!existingEvent) {
        const [insertedEvent] = await transaction
          .insert(events)
          .values({
            caseId,
            status: evaluation.status,
            ...evaluation.candidate,
          })
          .onConflictDoNothing({ target: events.caseId })
          .returning();

        if (insertedEvent) {
          return insertedEvent;
        }

        const [concurrentEvent] = await transaction
          .select()
          .from(events)
          .where(eq(events.caseId, caseId))
          .limit(1);

        if (!concurrentEvent) {
          throw new Error("The concurrently created Event could not be loaded.");
        }

        return concurrentEvent;
      }

      if (hasSameCandidate(existingEvent, evaluation.status, evaluation.candidate)) {
        return existingEvent;
      }

      const [updatedEvent] = await transaction
        .update(events)
        .set({
          status: evaluation.status,
          ...evaluation.candidate,
          version: sql`${events.version} + 1`,
        })
        .where(eq(events.id, existingEvent.id))
        .returning();

      if (!updatedEvent) {
        throw new Error("Updating an Event did not return a row.");
      }

      return updatedEvent;
    });

    return {
      ok: true as const,
      event,
      status: evaluation.status,
      missingFields: getMissingRequiredEventFields(evaluation.candidate),
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

      const existingOutcome = await this.findTerminalOutcome(transaction, caseId);

      if (existingOutcome) {
        return {
          ok: true as const,
          outcome: existingOutcome,
          reused: true,
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
        reused: false,
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

      const existingOutcome = await this.findTerminalOutcome(transaction, caseId);

      if (existingOutcome) {
        return {
          ok: true as const,
          outcome: existingOutcome,
          reused: true,
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
        reused: false,
      };
    });
  }

  async findOutcomeForMessage(inputMessageId: string) {
    const [message] = await this.databaseService.db
      .select({ caseId: chatMessages.caseId })
      .from(chatMessages)
      .where(eq(chatMessages.id, inputMessageId))
      .limit(1);

    if (!message?.caseId) {
      return undefined;
    }

    return this.findTerminalOutcome(this.databaseService.db, message.caseId);
  }

  // find the recent reply from assistant for a given caseId
  private async findTerminalOutcome(
    database: Pick<typeof this.databaseService.db, "select">,
    caseId: string,
  ): Promise<AgentTerminalOutcome | undefined> {
    const [outcome] = await database
      .select({
        event: events,
        assistantMessage: chatMessages,
      })
      .from(events)
      .innerJoin(
        chatMessages,
        and(
          eq(chatMessages.caseId, events.caseId),
          eq(chatMessages.role, "ASSISTANT"),
          inArray(chatMessages.kind, terminalMessageKinds),
        ),
      )
      .where(eq(events.caseId, caseId))
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(1);

    return outcome;
  }
}

function toDate(value: string | null) {
  return value === null ? null : new Date(value);
}

function hasSameCandidate(
  event: {
    status: "COLLECTING" | "READY";
    title: string | null;
    startAt: Date | null;
    endAt: Date | null;
    timeZone: string | null;
    location: string | null;
  },
  status: "COLLECTING" | "READY",
  candidate: {
    title: string | null;
    startAt: Date | null;
    endAt: Date | null;
    timeZone: string | null;
    location: string | null;
  },
) {
  return (
    event.status === status &&
    event.title === candidate.title &&
    datesEqual(event.startAt, candidate.startAt) &&
    datesEqual(event.endAt, candidate.endAt) &&
    event.timeZone === candidate.timeZone &&
    event.location === candidate.location
  );
}

function datesEqual(first: Date | null, second: Date | null) {
  return first?.getTime() === second?.getTime();
}
