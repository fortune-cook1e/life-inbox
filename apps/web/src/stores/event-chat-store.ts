"use client";

import {
  ApiError,
  confirmEventDraft,
  fetchMessages,
  rejectEventDraft,
  sendMessage,
  updateEventDraft,
} from "@/services/messages";
import type { TextMessage, TimelineMessage, UpdateEventDraftInput } from "@/types/messages";
import { create } from "zustand";

export type ConnectionState = "checking" | "connected" | "offline";
type DeliveryState = "sending" | "uncertain";

export type DisplayTextMessage = TextMessage & { delivery?: DeliveryState };

export interface ConversationNotice {
  tone: "info" | "error";
  title: string;
  description: string;
}

interface EventChatState {
  messages: TimelineMessage[];
  optimisticMessage: DisplayTextMessage | null;
  connection: ConnectionState;
  notice: ConversationNotice | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isDraftMutating: boolean;
  refreshRequired: boolean;
  composerRecoveryContent: string | null;
  clearComposerRecovery: () => void;
  initialize: () => Promise<void>;
  loadMessages: () => Promise<void>;
  submitMessage: (content: string) => Promise<void>;
  saveEventDraft: (draftId: string, input: UpdateEventDraftInput) => Promise<void>;
  confirmDraft: (draftId: string) => Promise<void>;
  rejectDraft: (draftId: string) => Promise<void>;
}

function getCurrentTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export const useEventChatStore = create<EventChatState>((set, get) => {
  let initializationStarted = false;
  let interactionLocked = false;

  async function replaceWithPersistedTimeline(signal?: AbortSignal) {
    const persistedMessages = await fetchMessages(signal);
    set({
      messages: persistedMessages,
      optimisticMessage: null,
      connection: "connected",
      refreshRequired: false,
    });
  }

  async function loadMessages() {
    set({ isLoading: true, connection: "checking" });

    try {
      await replaceWithPersistedTimeline();
      set({ notice: null });
    } catch (error) {
      set({
        connection: "offline",
        notice: {
          tone: "error",
          title: "Conversation unavailable",
          description:
            error instanceof ApiError
              ? error.message
              : "The conversation could not be loaded. Check the API and reload.",
        },
      });
    } finally {
      set({ isLoading: false });
    }
  }

  async function runDraftMutation(operation: () => Promise<unknown>) {
    if (interactionLocked) {
      throw new Error("Another conversation action is already in progress.");
    }

    interactionLocked = true;
    set({ isDraftMutating: true, notice: null });

    try {
      try {
        await operation();
      } catch (error) {
        if (error instanceof ApiError && (error.status === 0 || error.status === 408)) {
          set({
            refreshRequired: true,
            connection: error.status === 0 ? "offline" : "connected",
            notice: {
              tone: "error",
              title: "Action status unknown",
              description:
                "The Event Draft may already have changed. Reload the conversation before trying another action.",
            },
          });
          throw new Error(
            "The action status is unknown. Reload the conversation before trying again.",
            { cause: error },
          );
        }

        try {
          await replaceWithPersistedTimeline();
        } catch {
          set({
            refreshRequired: true,
            connection: "offline",
            notice: {
              tone: "error",
              title: "Action status unknown",
              description:
                "The Event Draft may have changed. Reload the conversation before trying another action.",
            },
          });
          throw new Error(
            "The action status is unknown because the latest timeline could not be loaded.",
            { cause: error },
          );
        }

        throw new Error(
          error instanceof ApiError
            ? `${error.message} The latest timeline has been loaded.`
            : "The action could not be completed. The latest timeline has been loaded.",
          { cause: error },
        );
      }

      try {
        await replaceWithPersistedTimeline();
      } catch {
        set({
          refreshRequired: true,
          connection: "offline",
          notice: {
            tone: "error",
            title: "Action saved, timeline not refreshed",
            description: "Reload before continuing so the Event Draft state stays in sync.",
          },
        });
        throw new Error(
          "The action was saved, but the timeline could not refresh. Reload before continuing.",
        );
      }
    } finally {
      interactionLocked = false;
      set({ isDraftMutating: false });
    }
  }

  return {
    messages: [],
    optimisticMessage: null,
    connection: "checking",
    notice: null,
    isLoading: true,
    isSubmitting: false,
    isDraftMutating: false,
    refreshRequired: false,
    composerRecoveryContent: null,

    clearComposerRecovery: () => set({ composerRecoveryContent: null }),

    initialize: async () => {
      if (initializationStarted) return;
      initializationStarted = true;
      await loadMessages();
    },

    loadMessages,

    submitMessage: async (submittedContent) => {
      const content = submittedContent.trim();
      const state = get();

      if (
        !content ||
        interactionLocked ||
        state.isSubmitting ||
        state.isLoading ||
        state.isDraftMutating ||
        state.refreshRequired ||
        content.length > 10_000
      ) {
        set({ composerRecoveryContent: content });
        return;
      }

      interactionLocked = true;
      const optimistic: DisplayTextMessage = {
        id: `optimistic-${crypto.randomUUID()}`,
        role: "user",
        kind: "text",
        content,
        createdAt: new Date().toISOString(),
        delivery: "sending",
      };

      set({
        optimisticMessage: optimistic,
        notice: null,
        isSubmitting: true,
        composerRecoveryContent: null,
      });

      try {
        const turn = await sendMessage({ content, timezone: getCurrentTimezone() });

        try {
          await replaceWithPersistedTimeline();
        } catch {
          set((current) => ({
            messages: [...current.messages, turn.userMessage, turn.assistantMessage],
            optimisticMessage: null,
            refreshRequired: true,
            notice: {
              tone: "error",
              title: "Message saved, timeline not refreshed",
              description:
                "Reload before continuing so Event Cards and clarification messages stay in sync.",
            },
          }));
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          set({
            optimisticMessage: null,
            composerRecoveryContent: content,
            notice: {
              tone: "error",
              title: "Message needs attention",
              description: error.message,
            },
          });
          return;
        }

        if (error instanceof ApiError && (error.status === 0 || error.status === 408)) {
          set({
            optimisticMessage: { ...optimistic, delivery: "uncertain" },
            connection: error.status === 0 ? "offline" : "connected",
            refreshRequired: true,
            composerRecoveryContent: content,
            notice: {
              tone: "error",
              title: "Delivery status unknown",
              description:
                "The request may still have reached the assistant. Your text has been restored, but reload the conversation before trying again.",
            },
          });
          return;
        }

        try {
          await replaceWithPersistedTimeline();
          set({
            notice: {
              tone: "error",
              title: "Assistant response incomplete",
              description:
                error instanceof ApiError
                  ? error.message
                  : "Your message may have been saved, but the assistant did not finish.",
            },
          });
        } catch {
          set({
            optimisticMessage: { ...optimistic, delivery: "uncertain" },
            connection: "offline",
            refreshRequired: true,
            composerRecoveryContent: content,
            notice: {
              tone: "error",
              title: "Delivery status unknown",
              description: "Reload the conversation before sending this message again.",
            },
          });
          return;
        }
      } finally {
        interactionLocked = false;
        set({ isSubmitting: false });
      }

      return;
    },

    saveEventDraft: (draftId, input) => runDraftMutation(() => updateEventDraft(draftId, input)),
    confirmDraft: (draftId) => runDraftMutation(() => confirmEventDraft(draftId)),
    rejectDraft: (draftId) => runDraftMutation(() => rejectEventDraft(draftId)),
  };
});
