import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { DatabaseService } from "../database/database.service.js";
import { chatMessages, events, lifeCases, pendingQuestions } from "../database/schema.js";
import {
  clarificationEvidenceIsSupported,
  findDateIssues,
  findClockTimeMismatch,
  getTemporalEvidenceParts,
  getTemporalPrecision,
  groundEventProposal,
  sameLocalDate,
  type EventProposalEvidence,
} from "../events/event-evidence.js";
import {
  evaluateEventCandidate,
  getMissingRequiredEventFields,
  type EventTimePrecision,
  type RequiredEventField,
} from "../events/event-readiness.js";
import { isClarificationAnswerCompatible } from "./clarification-compatibility.js";
import type {
  PendingQuestionCandidate,
  PendingQuestionCandidateTarget,
  PendingQuestionField,
} from "./agent.types.js";

export interface CalendarEventProposal {
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  evidence: EventProposalEvidence;
}

export type ClarificationAnswer =
  | { field: "title"; value: string; evidence: string }
  | { field: "startAt"; value: string; evidence: string }
  | { field: "endAt"; value: string; evidence: string }
  | { field: "timeZone"; value: string; evidence: string };

export interface ClarificationCandidateSetContext {
  candidateCount: number;
  hasMoreCandidates: boolean;
}

const EVENT_PREVIEW_MESSAGE = "Please review this event.";

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
    inputMessageId: string,
    caseId: string,
    proposal: CalendarEventProposal,
    defaultTimeZone: string,
  ) {
    const [inputMessage] = await this.databaseService.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, inputMessageId))
      .limit(1);

    if (
      !inputMessage ||
      inputMessage.caseId !== caseId ||
      inputMessage.role !== "USER" ||
      inputMessage.kind !== "USER_TEXT"
    ) {
      return {
        ok: false as const,
        reason: "INPUT_MESSAGE_NOT_AVAILABLE" as const,
      };
    }

    const groundedProposal = groundEventProposal(
      inputMessage.content,
      defaultTimeZone,
      inputMessage.createdAt,
      {
        title: proposal.title,
        startAt: toDate(proposal.startAt),
        endAt: toDate(proposal.endAt),
        location: proposal.location,
        evidence: proposal.evidence,
      },
    );

    if (!groundedProposal.valid) {
      return {
        ok: false as const,
        reason: "EVIDENCE_MISMATCH" as const,
        issues: groundedProposal.issues,
      };
    }

    const evaluation = evaluateEventCandidate(groundedProposal.candidate);

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
      let [existingPendingQuestion] = await transaction
        .select()
        .from(pendingQuestions)
        .where(and(eq(pendingQuestions.eventId, eventId), eq(pendingQuestions.status, "OPEN")))
        .for("update")
        .limit(1);

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

      if (!existingPendingQuestion) {
        [existingPendingQuestion] = await transaction
          .select()
          .from(pendingQuestions)
          .where(and(eq(pendingQuestions.eventId, eventId), eq(pendingQuestions.status, "OPEN")))
          .for("update")
          .limit(1);
      }

      if (existingPendingQuestion) {
        const [existingQuestionMessage] = await transaction
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.id, existingPendingQuestion.questionMessageId))
          .limit(1);

        if (!isClarificationQuestion(existingQuestionMessage, caseId)) {
          throw new Error("The open PendingQuestion references an invalid ChatMessage.");
        }

        if (existingPendingQuestion.expectedField !== field) {
          return {
            ok: false as const,
            reason: "DIFFERENT_OPEN_QUESTION" as const,
            expectedField: existingPendingQuestion.expectedField,
          };
        }

        return {
          ok: true as const,
          outcome: {
            outcome: "CLARIFICATION_QUESTION" as const,
            event,
            assistantMessage: existingQuestionMessage,
          },
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

      const [pendingQuestion] = await transaction
        .insert(pendingQuestions)
        .values({
          eventId,
          questionMessageId: assistantMessage.id,
          expectedField: field,
          eventVersion: event.version,
        })
        .returning();

      if (!pendingQuestion) {
        throw new Error("Creating a PendingQuestion did not return a row.");
      }

      return {
        ok: true as const,
        outcome: {
          outcome: "CLARIFICATION_QUESTION" as const,
          event,
          assistantMessage,
        },
      };
    });
  }

  async searchPendingQuestions(fields: PendingQuestionField[]) {
    const rows = await this.databaseService.db
      .select({
        pendingQuestion: pendingQuestions,
        event: events,
      })
      .from(pendingQuestions)
      .innerJoin(events, eq(events.id, pendingQuestions.eventId))
      .innerJoin(lifeCases, eq(lifeCases.id, events.caseId))
      .where(
        and(
          eq(pendingQuestions.status, "OPEN"),
          eq(events.status, "COLLECTING"),
          eq(lifeCases.status, "OPEN"),
          inArray(pendingQuestions.expectedField, fields),
        ),
      )
      .orderBy(desc(pendingQuestions.createdAt), desc(pendingQuestions.id))
      .limit(3);

    const candidates = await Promise.all(
      rows
        .slice(0, 2)
        .map(({ pendingQuestion, event }) =>
          this.loadPendingQuestionCandidate(pendingQuestion, event),
        ),
    );

    return {
      candidates,
      hasMore: rows.length > 2,
    };
  }

  async applyClarificationAnswer(
    inputMessageId: string,
    target: PendingQuestionCandidateTarget,
    answer: ClarificationAnswer,
    routingContext: ClarificationCandidateSetContext = {
      candidateCount: 1,
      hasMoreCandidates: false,
    },
  ) {
    if (answer.field !== target.expectedField) {
      return {
        ok: false as const,
        reason: "FIELD_DOES_NOT_MATCH_CANDIDATE" as const,
        expectedField: target.expectedField,
      };
    }

    return this.databaseService.db.transaction(async (transaction) => {
      const [pendingQuestion] = await transaction
        .select()
        .from(pendingQuestions)
        .where(eq(pendingQuestions.id, target.pendingQuestionId))
        .for("update")
        .limit(1);

      if (
        !pendingQuestion ||
        pendingQuestion.status !== "OPEN" ||
        pendingQuestion.eventId !== target.eventId ||
        pendingQuestion.expectedField !== target.expectedField
      ) {
        return {
          ok: false as const,
          reason: "PENDING_QUESTION_NOT_OPEN" as const,
        };
      }

      const [event] = await transaction
        .select()
        .from(events)
        .where(eq(events.id, target.eventId))
        .for("update")
        .limit(1);

      if (
        !event ||
        event.caseId !== target.caseId ||
        event.status !== "COLLECTING" ||
        event.version !== pendingQuestion.eventVersion
      ) {
        return {
          ok: false as const,
          reason: "EVENT_NOT_CURRENT" as const,
        };
      }

      const [inputMessage] = await transaction
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.id, inputMessageId))
        .for("update")
        .limit(1);

      if (
        !inputMessage ||
        inputMessage.caseId !== null ||
        inputMessage.role !== "USER" ||
        inputMessage.kind !== "USER_TEXT"
      ) {
        return {
          ok: false as const,
          reason: "INPUT_MESSAGE_NOT_AVAILABLE" as const,
        };
      }

      if (!clarificationEvidenceIsSupported(inputMessage.content, answer.field, answer.evidence)) {
        return {
          ok: false as const,
          reason: "ANSWER_EVIDENCE_MISMATCH" as const,
        };
      }

      if (
        !isClarificationAnswerCompatible({
          userText: inputMessage.content,
          evidence: answer.evidence,
          eventTitle: event.title,
          eventLocation: event.location,
          ...routingContext,
        })
      ) {
        return {
          ok: false as const,
          reason: "ANSWER_DOES_NOT_REFERENCE_CANDIDATE" as const,
        };
      }

      const [questionMessage] = await transaction
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.id, pendingQuestion.questionMessageId))
        .limit(1);

      if (!isClarificationQuestion(questionMessage, event.caseId)) {
        throw new Error("The PendingQuestion references an invalid clarification ChatMessage.");
      }

      let temporalPrecision: EventTimePrecision | null = null;

      if (answer.field === "startAt" || answer.field === "endAt") {
        const timeZone = event.timeZone ?? "UTC";
        const value = new Date(answer.value);
        const evidenceParts = getTemporalEvidenceParts(answer.evidence);
        temporalPrecision = getTemporalPrecision(answer.evidence);
        const dateIssues = findDateIssues(
          answer.field,
          answer.evidence,
          value,
          timeZone,
          inputMessage.createdAt,
        );
        const existingValue = answer.field === "startAt" ? event.startAt : event.endAt;
        const changedDateWithoutEvidence =
          evidenceParts.hasTime &&
          !evidenceParts.hasDate &&
          existingValue !== null &&
          !sameLocalDate(existingValue, value, timeZone);
        const timeIssue = evidenceParts.hasTime
          ? findClockTimeMismatch(answer.field, answer.evidence, value, timeZone)
          : findClockTimeMismatch(answer.field, "09:00", value, timeZone);

        if (
          !temporalPrecision ||
          dateIssues.length > 0 ||
          changedDateWithoutEvidence ||
          timeIssue
        ) {
          return {
            ok: false as const,
            reason: "ANSWER_EVIDENCE_MISMATCH" as const,
            issues: [
              ...dateIssues,
              ...(changedDateWithoutEvidence
                ? ["LOCAL_DATE_CHANGED_WITHOUT_EVIDENCE" as const]
                : []),
              ...(timeIssue ? [timeIssue] : []),
            ],
          };
        }
      }

      const currentEvaluation = evaluateEventCandidate(event);

      if (!currentEvaluation.valid) {
        return {
          ok: false as const,
          reason: "INVALID_EVENT" as const,
          issues: currentEvaluation.issues,
        };
      }

      const missingFields = getMissingRequiredEventFields(currentEvaluation.candidate);

      if (!missingFields.includes(answer.field)) {
        return {
          ok: false as const,
          reason: "FIELD_IS_NO_LONGER_MISSING" as const,
          missingFields,
        };
      }

      const candidate = {
        ...currentEvaluation.candidate,
        [answer.field]: clarificationValue(answer),
        ...(answer.field === "startAt" ? { startAtPrecision: temporalPrecision } : {}),
        ...(answer.field === "endAt" ? { endAtPrecision: temporalPrecision } : {}),
      };
      const updatedEvaluation = evaluateEventCandidate(candidate);

      if (!updatedEvaluation.valid) {
        return {
          ok: false as const,
          reason: "INVALID_ANSWER" as const,
          issues: updatedEvaluation.issues,
        };
      }

      const [updatedEvent] = await transaction
        .update(events)
        .set({
          ...eventPatch(answer.field, updatedEvaluation.candidate),
          status: updatedEvaluation.status,
          version: sql`${events.version} + 1`,
        })
        .where(and(eq(events.id, event.id), eq(events.version, event.version)))
        .returning();

      if (!updatedEvent) {
        return {
          ok: false as const,
          reason: "EVENT_VERSION_CONFLICT" as const,
        };
      }

      const [updatedInputMessage] = await transaction
        .update(chatMessages)
        .set({
          caseId: event.caseId,
          kind: "CLARIFICATION_ANSWER",
        })
        .where(
          and(
            eq(chatMessages.id, inputMessageId),
            eq(chatMessages.role, "USER"),
            eq(chatMessages.kind, "USER_TEXT"),
            sql`${chatMessages.caseId} is null`,
          ),
        )
        .returning();

      if (!updatedInputMessage) {
        throw new Error("Binding the clarification answer did not return a ChatMessage.");
      }

      const resolvedAt = new Date();
      const [resolvedPendingQuestion] = await transaction
        .update(pendingQuestions)
        .set({
          status: "RESOLVED",
          resolvedByMessageId: updatedInputMessage.id,
          resolvedAt,
        })
        .where(
          and(eq(pendingQuestions.id, pendingQuestion.id), eq(pendingQuestions.status, "OPEN")),
        )
        .returning({ id: pendingQuestions.id });

      if (!resolvedPendingQuestion) {
        throw new Error("Resolving the PendingQuestion did not return a row.");
      }

      return {
        ok: true as const,
        caseId: event.caseId,
        event: updatedEvent,
        inputMessage: updatedInputMessage,
        status: updatedEvaluation.status,
        missingFields: getMissingRequiredEventFields(updatedEvaluation.candidate),
      };
    });
  }

  async requestRestatement(message: string) {
    const normalizedMessage = message.trim();

    if (!normalizedMessage) {
      return {
        ok: false as const,
        reason: "MESSAGE_NOT_BLANK" as const,
      };
    }

    const [assistantMessage] = await this.databaseService.db
      .insert(chatMessages)
      .values({
        role: "ASSISTANT",
        kind: "CLARIFICATION_QUESTION",
        content: normalizedMessage,
      })
      .returning();

    if (!assistantMessage) {
      throw new Error("Creating a restatement ChatMessage did not return a row.");
    }

    return {
      ok: true as const,
      outcome: {
        outcome: "RESTATEMENT_REQUIRED" as const,
        assistantMessage,
        event: null,
      },
    };
  }

  finishMessageOnly() {
    return {
      ok: true as const,
      outcome: {
        outcome: "MESSAGE_ONLY" as const,
        assistantMessage: null,
        event: null,
      },
    };
  }

  async showEventPreview(caseId: string, eventId: string) {
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
          content: EVENT_PREVIEW_MESSAGE,
        })
        .returning();

      if (!assistantMessage) {
        throw new Error("Creating an Event Preview ChatMessage did not return a row.");
      }

      return {
        ok: true as const,
        outcome: {
          outcome: "EVENT_PREVIEW" as const,
          event,
          assistantMessage,
        },
      };
    });
  }

  private async loadPendingQuestionCandidate(
    pendingQuestion: typeof pendingQuestions.$inferSelect,
    event: typeof events.$inferSelect,
  ): Promise<PendingQuestionCandidate> {
    const [questionMessage] = await this.databaseService.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, pendingQuestion.questionMessageId))
      .limit(1);

    if (!isClarificationQuestion(questionMessage, event.caseId)) {
      throw new Error("A PendingQuestion candidate references an invalid ChatMessage.");
    }

    const [firstUserMessage] = await this.databaseService.db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.caseId, event.caseId), eq(chatMessages.role, "USER")))
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id))
      .limit(1);

    if (!firstUserMessage) {
      throw new Error("A PendingQuestion candidate has no Case-bound user message.");
    }

    const recentMessages = await this.databaseService.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.caseId, event.caseId))
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(6);
    const messages = deduplicateMessages([firstUserMessage, ...recentMessages]).sort(
      compareMessages,
    );

    return {
      pendingQuestionId: pendingQuestion.id,
      eventId: event.id,
      caseId: event.caseId,
      expectedField: pendingQuestion.expectedField,
      question: {
        content: questionMessage.content,
        createdAt: questionMessage.createdAt,
      },
      event,
      messages: messages.map(({ role, kind, content, createdAt }) => ({
        role,
        kind,
        content,
        createdAt,
      })),
    };
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

function isClarificationQuestion(
  message: typeof chatMessages.$inferSelect | undefined,
  caseId: string,
): message is typeof chatMessages.$inferSelect {
  return (
    message?.caseId === caseId &&
    message.role === "ASSISTANT" &&
    message.kind === "CLARIFICATION_QUESTION"
  );
}

function clarificationValue(answer: ClarificationAnswer) {
  return answer.field === "startAt" || answer.field === "endAt"
    ? new Date(answer.value)
    : answer.value;
}

function eventPatch(
  field: PendingQuestionField,
  candidate: {
    title: string | null;
    startAt: Date | null;
    startAtPrecision: "DATE_ONLY" | "DATE_TIME" | null;
    endAt: Date | null;
    endAtPrecision: "DATE_ONLY" | "DATE_TIME" | null;
    timeZone: string | null;
  },
) {
  switch (field) {
    case "title":
      return { title: candidate.title };
    case "startAt":
      return { startAt: candidate.startAt, startAtPrecision: candidate.startAtPrecision };
    case "endAt":
      return { endAt: candidate.endAt, endAtPrecision: candidate.endAtPrecision };
    case "timeZone":
      return { timeZone: candidate.timeZone };
  }
}

function deduplicateMessages(messages: Array<typeof chatMessages.$inferSelect>) {
  return [...new Map(messages.map((message) => [message.id, message])).values()];
}

function compareMessages(
  first: typeof chatMessages.$inferSelect,
  second: typeof chatMessages.$inferSelect,
) {
  const timeDifference = first.createdAt.getTime() - second.createdAt.getTime();

  return timeDifference === 0 ? first.id.localeCompare(second.id) : timeDifference;
}

function toDate(value: string | null) {
  return value === null ? null : new Date(value);
}
