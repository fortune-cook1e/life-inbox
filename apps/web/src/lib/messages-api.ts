import { apiClient, ApiClientError } from "./api-client";

export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export type MessageKind =
  | "USER_TEXT"
  | "SOURCE_SUBMITTED"
  | "CLARIFICATION_QUESTION"
  | "CLARIFICATION_ANSWER"
  | "EVENT_EDIT"
  | "DRAFT_PROGRESS"
  | "EVENT_PREVIEW"
  | "EVENT_CONFIRMED"
  | "EVENT_UPDATE_PREVIEW"
  | "EVENT_CANCELLATION_PREVIEW"
  | "EVENT_QUERY_RESULT"
  | "STATUS";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  createdAt: string;
}

export type EventStatus = "COLLECTING" | "READY";
export type EventTimePrecision = "DATE_ONLY" | "DATE_TIME";

export interface EventResponse {
  id: string;
  status: EventStatus;
  title: string | null;
  startAt: string | null;
  startAtPrecision: EventTimePrecision | null;
  endAt: string | null;
  endAtPrecision: EventTimePrecision | null;
  timeZone: string | null;
  location: string | null;
  version: number;
}

export type CalendarEvent = EventResponse;

export type MessageOutcome =
  "EVENT_PREVIEW" | "CLARIFICATION_QUESTION" | "RESTATEMENT_REQUIRED" | "MESSAGE_ONLY";

export interface MessagesPageResponse {
  items: ChatMessage[];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export interface SendMessageInput {
  clientMessageId: string;
  content: string;
  timeZone?: string;
}

export interface SendMessageResponse {
  outcome: MessageOutcome;
  message: ChatMessage;
  assistantMessage: ChatMessage | null;
  event: EventResponse | null;
}

export interface FetchRecentMessagesOptions {
  limit?: number;
  cursor?: string;
  signal?: AbortSignal;
}

export interface SendMessageOptions {
  signal?: AbortSignal;
}

const LIST_MESSAGES_TIMEOUT_MS = 20_000;
const SEND_MESSAGE_TIMEOUT_MS = 125_000;
const PERSISTED_AGENT_ERROR_MESSAGE =
  "Your message was saved, but the Agent could not finish processing it.";

export { ApiClientError as ApiError, ApiClientError as MessagesApiError };

export function fetchRecentMessages(limit: number): Promise<MessagesPageResponse>;
export function fetchRecentMessages(
  options?: FetchRecentMessagesOptions,
): Promise<MessagesPageResponse>;
export async function fetchRecentMessages(
  limitOrOptions: number | FetchRecentMessagesOptions = {},
): Promise<MessagesPageResponse> {
  const options = typeof limitOrOptions === "number" ? { limit: limitOrOptions } : limitOrOptions;
  const searchParams = new URLSearchParams();

  if (options.limit !== undefined) {
    searchParams.set("limit", String(options.limit));
  }

  if (options.cursor !== undefined) {
    searchParams.set("cursor", options.cursor);
  }

  const query = searchParams.toString();
  const response = await apiClient.get<MessagesPageResponse>(
    `/messages${query ? `?${query}` : ""}`,
    {
      signal: options.signal,
      timeout: LIST_MESSAGES_TIMEOUT_MS,
    },
  );

  return response.data;
}

export async function sendMessage(
  input: SendMessageInput,
  options: SendMessageOptions = {},
): Promise<SendMessageResponse> {
  const response = await apiClient.post<SendMessageResponse>("/messages", input, {
    signal: options.signal,
    timeout: SEND_MESSAGE_TIMEOUT_MS,
  });

  return response.data;
}

export function isPersistedAgentError(error: unknown): error is ApiClientError {
  return (
    error instanceof ApiClientError &&
    error.status === 503 &&
    error.apiCode === 2 &&
    error.message === PERSISTED_AGENT_ERROR_MESSAGE
  );
}
