import type { InferSelectModel } from "drizzle-orm";

import { chatMessages, events } from "../database/schema.js";

export type ChatMessage = InferSelectModel<typeof chatMessages>;
export type CalendarEvent = InferSelectModel<typeof events>;

export interface AgentTerminalOutcome {
  assistantMessage: ChatMessage;
  event: CalendarEvent;
}

export interface AgentExecutionState {
  inputMessageId: string;
  caseId?: string;
  eventId?: string;
  terminalOutcome?: AgentTerminalOutcome;
}
