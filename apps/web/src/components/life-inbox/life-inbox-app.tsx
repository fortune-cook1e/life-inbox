"use client";

import { useEffect, useRef } from "react";

import { ConversationHeader } from "./conversation-header";
import { ConversationNotice } from "./conversation-notice";
import { ConversationTimeline } from "./conversation-timeline";
import { MessageComposer } from "./message-composer";
import { useLifeInbox } from "./use-life-inbox";

export function LifeInboxApp() {
  const inbox = useLifeInbox();
  const endOfConversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfConversationRef.current?.scrollIntoView({ block: "end" });
  }, [inbox.isLoading, inbox.isSubmitting, inbox.notice, inbox.timeline.length]);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-foreground px-3 py-2 text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to conversation
      </a>

      <ConversationHeader
        connection={inbox.connection}
        isLoading={inbox.isLoading}
        isBusy={inbox.isBusy}
        onReload={inbox.loadMessages}
      />

      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
          <ConversationTimeline
            timeline={inbox.timeline}
            draftStates={inbox.draftStates}
            isLoading={inbox.isLoading}
            isSubmitting={inbox.isSubmitting}
            actionsDisabled={inbox.isSubmitting || inbox.isDraftMutating || inbox.refreshRequired}
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
        isSubmitting={inbox.isSubmitting}
        disabled={inbox.isBusy || inbox.refreshRequired}
        refreshRequired={inbox.refreshRequired}
        onSubmit={inbox.submitMessage}
      />
    </div>
  );
}
