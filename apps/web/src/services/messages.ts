import { apiClient, ApiClientError } from "@/lib/api-client";
import type {
  EventConfirmMessage,
  EventEditMessage,
  EventRejectMessage,
  MessageTurnResponse,
  SendMessageInput,
  TextMessage,
  TimelineMessage,
  UpdateEventDraftInput,
} from "@/types/messages";

const LIST_MESSAGES_TIMEOUT_MS = 20_000;
const SEND_MESSAGE_TIMEOUT_MS = 125_000;

export { ApiClientError as ApiError, ApiClientError as MessagesApiError };

export async function fetchMessages(signal?: AbortSignal): Promise<TimelineMessage[]> {
  const response = await apiClient.get<TimelineMessage[]>("/messages", {
    signal,
    timeout: LIST_MESSAGES_TIMEOUT_MS,
  });
  return response.data;
}

export async function sendMessage(
  input: SendMessageInput,
  signal?: AbortSignal,
): Promise<MessageTurnResponse> {
  const response = await apiClient.post<MessageTurnResponse>("/messages", input, {
    signal,
    timeout: SEND_MESSAGE_TIMEOUT_MS,
  });
  return response.data;
}

export async function updateEventDraft(
  draftId: string,
  input: UpdateEventDraftInput,
): Promise<EventEditMessage> {
  const response = await apiClient.patch<EventEditMessage>(`/event-drafts/${draftId}`, input);
  return response.data;
}

export async function confirmEventDraft(draftId: string): Promise<EventConfirmMessage> {
  const response = await apiClient.post<EventConfirmMessage>(`/event-drafts/${draftId}/confirm`);
  return response.data;
}

export async function rejectEventDraft(
  draftId: string,
): Promise<[EventRejectMessage, TextMessage & { role: "assistant" }]> {
  const response = await apiClient.post<[EventRejectMessage, TextMessage & { role: "assistant" }]>(
    `/event-drafts/${draftId}/reject`,
  );
  return response.data;
}
