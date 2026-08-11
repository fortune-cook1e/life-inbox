import type { InferSelectModel } from "drizzle-orm";

import { chatMessages, events, pendingQuestions } from "../database/schema.js";

export type ChatMessage = InferSelectModel<typeof chatMessages>;
export type CalendarEvent = InferSelectModel<typeof events>;
export type PendingQuestion = InferSelectModel<typeof pendingQuestions>;
export type PendingQuestionField = PendingQuestion["expectedField"];

export interface PendingQuestionCandidateTarget {
  pendingQuestionId: string;
  eventId: string;
  caseId: string;
  expectedField: PendingQuestionField;
}

export interface PendingQuestionCandidate extends PendingQuestionCandidateTarget {
  question: Pick<ChatMessage, "content" | "createdAt">;
  event: CalendarEvent;
  messages: Array<Pick<ChatMessage, "role" | "kind" | "content" | "createdAt">>;
}

export type AgentOutcomeKind =
  "EVENT_PREVIEW" | "CLARIFICATION_QUESTION" | "RESTATEMENT_REQUIRED" | "MESSAGE_ONLY";

export interface AgentTerminalOutcome {
  outcome: AgentOutcomeKind;
  assistantMessage: ChatMessage | null;
  event: CalendarEvent | null;
}

export interface AgentExecutionState {
  inputMessageId: string;
  caseId?: string;
  eventId?: string;
  candidateAliases: Map<string, PendingQuestionCandidateTarget>;
  hasMorePendingCandidates?: boolean;
  preferredTerminalTool?: "ask_user" | "show_event_preview";
  missingClarificationFields?: PendingQuestionField[];
  terminalOutcome?: AgentTerminalOutcome;
}
