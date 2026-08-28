"use client";

import { buildEventDraftStates } from "@/lib/timeline";
import {
  ApiError,
  confirmEventDraft,
  fetchMessages,
  rejectEventDraft,
  sendMessage,
  updateEventDraft,
} from "@/services/messages";
import type { TextMessage, TimelineMessage, UpdateEventDraftInput } from "@/types/messages";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ConnectionState = "checking" | "connected" | "offline";
type DeliveryState = "sending" | "uncertain";

export type DisplayTextMessage = TextMessage & { delivery?: DeliveryState };

export interface ConversationNotice {
  tone: "info" | "error";
  title: string;
  description: string;
}

function getCurrentTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function useLifeInbox() {
  const interactionLockRef = useRef(false);
  const [messages, setMessages] = useState<TimelineMessage[]>([]);
  const [optimisticMessage, setOptimisticMessage] = useState<DisplayTextMessage | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [notice, setNotice] = useState<ConversationNotice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftMutating, setIsDraftMutating] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);

  const draftStates = useMemo(() => buildEventDraftStates(messages), [messages]);
  const timeline = useMemo(
    () => (optimisticMessage ? [...messages, optimisticMessage] : messages),
    [messages, optimisticMessage],
  );

  const replaceWithPersistedTimeline = useCallback(async (signal?: AbortSignal) => {
    const persistedMessages = await fetchMessages(signal);
    setMessages(persistedMessages);
    setOptimisticMessage(null);
    setConnection("connected");
    setRefreshRequired(false);
  }, []);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    setConnection("checking");

    try {
      await replaceWithPersistedTimeline();
      setNotice(null);
    } catch (error) {
      setConnection("offline");
      setNotice({
        tone: "error",
        title: "Conversation unavailable",
        description:
          error instanceof ApiError
            ? error.message
            : "LifeInbox could not load the conversation. Check the API and reload.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [replaceWithPersistedTimeline]);

  useEffect(() => {
    const controller = new AbortController();

    void replaceWithPersistedTimeline(controller.signal)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;

        setConnection("offline");
        setNotice({
          tone: "error",
          title: "Conversation unavailable",
          description:
            error instanceof ApiError
              ? error.message
              : "LifeInbox could not load the conversation. Check the API and reload.",
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [replaceWithPersistedTimeline]);

  const submitMessage = useCallback(
    async (submittedContent: string) => {
      const content = submittedContent.trim();
      if (
        !content ||
        interactionLockRef.current ||
        isSubmitting ||
        isLoading ||
        isDraftMutating ||
        refreshRequired ||
        content.length > 10_000
      )
        return true;

      interactionLockRef.current = true;
      const optimistic: DisplayTextMessage = {
        id: `optimistic-${crypto.randomUUID()}`,
        role: "user",
        kind: "text",
        content,
        createdAt: new Date().toISOString(),
        delivery: "sending",
      };

      setOptimisticMessage(optimistic);
      setNotice(null);
      setIsSubmitting(true);

      try {
        const turn = await sendMessage({ content, timezone: getCurrentTimezone() });

        try {
          await replaceWithPersistedTimeline();
        } catch {
          setMessages((current) => [...current, turn.userMessage, turn.assistantMessage]);
          setOptimisticMessage(null);
          setRefreshRequired(true);
          setNotice({
            tone: "error",
            title: "Message saved, timeline not refreshed",
            description:
              "Reload before continuing so Event Cards and clarification messages stay in sync.",
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          setOptimisticMessage(null);
          setNotice({
            tone: "error",
            title: "Message needs attention",
            description: error.message,
          });
          return true;
        } else if (error instanceof ApiError && (error.status === 0 || error.status === 408)) {
          setOptimisticMessage({ ...optimistic, delivery: "uncertain" });
          setConnection(error.status === 0 ? "offline" : "connected");
          setRefreshRequired(true);
          setNotice({
            tone: "error",
            title: "Delivery status unknown",
            description:
              "The request may still have reached LifeInbox. Your text has been restored, but reload the conversation before trying again.",
          });
          return true;
        } else {
          try {
            await replaceWithPersistedTimeline();
            setNotice({
              tone: "error",
              title: "Assistant response incomplete",
              description:
                error instanceof ApiError
                  ? error.message
                  : "Your message may have been saved, but the assistant did not finish.",
            });
          } catch {
            setOptimisticMessage({ ...optimistic, delivery: "uncertain" });
            setConnection("offline");
            setRefreshRequired(true);
            setNotice({
              tone: "error",
              title: "Delivery status unknown",
              description: "Reload the conversation before sending this message again.",
            });
            return true;
          }
        }
      } finally {
        interactionLockRef.current = false;
        setIsSubmitting(false);
      }
      return false;
    },
    [isDraftMutating, isLoading, isSubmitting, refreshRequired, replaceWithPersistedTimeline],
  );

  const runDraftMutation = useCallback(
    async (operation: () => Promise<unknown>) => {
      if (interactionLockRef.current) {
        throw new Error("Another conversation action is already in progress.");
      }

      interactionLockRef.current = true;
      setIsDraftMutating(true);
      setNotice(null);

      try {
        try {
          await operation();
        } catch (error) {
          if (error instanceof ApiError && (error.status === 0 || error.status === 408)) {
            setRefreshRequired(true);
            setConnection(error.status === 0 ? "offline" : "connected");
            setNotice({
              tone: "error",
              title: "Action status unknown",
              description:
                "The Event Draft may already have changed. Reload the conversation before trying another action.",
            });
            throw new Error(
              "The action status is unknown. Reload the conversation before trying again.",
              { cause: error },
            );
          }

          try {
            await replaceWithPersistedTimeline();
          } catch {
            setRefreshRequired(true);
            setConnection("offline");
            setNotice({
              tone: "error",
              title: "Action status unknown",
              description:
                "The Event Draft may have changed. Reload the conversation before trying another action.",
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
          setRefreshRequired(true);
          setConnection("offline");
          setNotice({
            tone: "error",
            title: "Action saved, timeline not refreshed",
            description: "Reload before continuing so the Event Draft state stays in sync.",
          });
          throw new Error(
            "The action was saved, but the timeline could not refresh. Reload before continuing.",
          );
        }
      } finally {
        interactionLockRef.current = false;
        setIsDraftMutating(false);
      }
    },
    [replaceWithPersistedTimeline],
  );

  const saveEventDraft = useCallback(
    (draftId: string, input: UpdateEventDraftInput) =>
      runDraftMutation(() => updateEventDraft(draftId, input)),
    [runDraftMutation],
  );
  const confirmDraft = useCallback(
    (draftId: string) => runDraftMutation(() => confirmEventDraft(draftId)),
    [runDraftMutation],
  );
  const rejectDraft = useCallback(
    (draftId: string) => runDraftMutation(() => rejectEventDraft(draftId)),
    [runDraftMutation],
  );

  const isBusy = isLoading || isSubmitting || isDraftMutating;

  return {
    confirmDraft,
    connection,
    draftStates,
    isBusy,
    isDraftMutating,
    isLoading,
    isSubmitting,
    loadMessages,
    notice,
    refreshRequired,
    rejectDraft,
    saveEventDraft,
    submitMessage,
    timeline,
  };
}
