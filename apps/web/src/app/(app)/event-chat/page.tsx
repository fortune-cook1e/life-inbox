"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { buildEventDraftStates } from "@/lib/timeline";
import { useEventChatStore } from "@/stores/event-chat-store";

import { ConversationHeader } from "./_components/conversation-header";
import { ConversationNotice } from "./_components/conversation-notice";
import { ConversationTimeline } from "./_components/conversation-timeline";
import { MessageComposer } from "./_components/message-composer";

export default function EventChatPage() {
  const endOfConversationRef = useRef<HTMLDivElement>(null);
  const [composerPrefillContent, setComposerPrefillContent] = useState<string | null>(null);
  const inbox = useEventChatStore(
    useShallow((state) => ({
      clearComposerRecovery: state.clearComposerRecovery,
      composerRecoveryContent: state.composerRecoveryContent,
      confirmDraft: state.confirmDraft,
      connection: state.connection,
      initialize: state.initialize,
      isDraftMutating: state.isDraftMutating,
      isLoading: state.isLoading,
      isSubmitting: state.isSubmitting,
      loadMessages: state.loadMessages,
      messages: state.messages,
      notice: state.notice,
      optimisticMessage: state.optimisticMessage,
      refreshRequired: state.refreshRequired,
      rejectDraft: state.rejectDraft,
      saveEventDraft: state.saveEventDraft,
      submitMessage: state.submitMessage,
    })),
  );
  const draftStates = useMemo(() => buildEventDraftStates(inbox.messages), [inbox.messages]);
  const timeline = useMemo(
    () => (inbox.optimisticMessage ? [...inbox.messages, inbox.optimisticMessage] : inbox.messages),
    [inbox.messages, inbox.optimisticMessage],
  );
  const isBusy = inbox.isLoading || inbox.isSubmitting || inbox.isDraftMutating;

  useEffect(() => {
    void inbox.initialize();
  }, [inbox.initialize]);

  useEffect(() => {
    endOfConversationRef.current?.scrollIntoView({ block: "end" });
  }, [inbox.isLoading, inbox.isSubmitting, inbox.notice, timeline.length]);

  return (
    <section className="flex h-[100dvh] min-h-0 flex-col bg-background text-foreground">
      <ConversationHeader
        connection={inbox.connection}
        isLoading={inbox.isLoading}
        isBusy={isBusy}
        onReload={inbox.loadMessages}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
          <ConversationTimeline
            timeline={timeline}
            draftStates={draftStates}
            isLoading={inbox.isLoading}
            isSubmitting={inbox.isSubmitting}
            actionsDisabled={inbox.isSubmitting || inbox.isDraftMutating || inbox.refreshRequired}
            onSuggestionSelect={setComposerPrefillContent}
            onSave={inbox.saveEventDraft}
            onConfirm={inbox.confirmDraft}
            onReject={inbox.rejectDraft}
          />

          {inbox.notice ? (
            <ConversationNotice
              notice={inbox.notice}
              refreshRequired={inbox.refreshRequired}
              isLoading={inbox.isLoading}
              onReload={inbox.loadMessages}
            />
          ) : null}

          <div ref={endOfConversationRef} className="h-px" aria-hidden="true" />
        </div>
      </main>

      <MessageComposer
        prefillContent={composerPrefillContent}
        recoveryContent={inbox.composerRecoveryContent}
        onPrefillApplied={() => setComposerPrefillContent(null)}
        onRecoveryApplied={inbox.clearComposerRecovery}
        disabled={isBusy || inbox.refreshRequired}
        refreshRequired={inbox.refreshRequired}
        onSubmit={inbox.submitMessage}
      />
    </section>
  );
}
