import type { EventDraftTimelineState } from "@/lib/timeline";
import type { TimelineMessage, UpdateEventDraftInput } from "@/types/messages";
import { Check, LoaderCircle } from "lucide-react";
import { memo } from "react";

import { TimelineMessageItem } from "./timeline-message";
import type { DisplayTextMessage } from "./use-life-inbox";

interface ConversationTimelineProps {
  timeline: Array<TimelineMessage | DisplayTextMessage>;
  draftStates: Record<string, EventDraftTimelineState>;
  isLoading: boolean;
  isSubmitting: boolean;
  actionsDisabled: boolean;
  onSave: (draftId: string, input: UpdateEventDraftInput) => Promise<void>;
  onConfirm: (draftId: string) => Promise<void>;
  onReject: (draftId: string) => Promise<void>;
}

export const ConversationTimeline = memo(function ConversationTimeline({
  timeline,
  draftStates,
  isLoading,
  isSubmitting,
  actionsDisabled,
  onSave,
  onConfirm,
  onReject,
}: ConversationTimelineProps) {
  if (isLoading && timeline.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 size-4 motion-safe:animate-spin" aria-hidden="true" />
        Loading conversation
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center sm:py-24">
        <div className="grid size-12 place-items-center rounded-[18px] bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(39,75,52,0.18)]">
          <Check className="size-6" strokeWidth={2.4} aria-hidden="true" />
        </div>
        <h2 className="mt-6 text-balance text-2xl font-semibold tracking-[-0.012em] text-foreground sm:text-[28px]">
          What should I remember?
        </h2>
        <p className="mt-3 text-pretty text-sm leading-6 text-muted-foreground">
          Tell me about an appointment, deadline, or reminder. If a required detail is missing, I
          will ask one question at a time.
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-7 sm:space-y-8"
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {timeline.map((message) => {
        const draftState =
          message.kind === "event_card" || message.kind === "event_edit"
            ? draftStates[message.payload.draftId]
            : undefined;

        return (
          <div
            key={message.id}
            className="[contain-intrinsic-size:auto_160px] [content-visibility:auto]"
          >
            <TimelineMessageItem
              message={message}
              draftState={draftState}
              actionsDisabled={actionsDisabled}
              onSave={onSave}
              onConfirm={onConfirm}
              onReject={onReject}
            />
          </div>
        );
      })}
      {isSubmitting ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
          <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
            <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
          </div>
          <span>Working through the next step</span>
        </div>
      ) : null}
    </div>
  );
});
