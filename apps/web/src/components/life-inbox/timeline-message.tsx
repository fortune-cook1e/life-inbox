import { EventDraftCard } from "./event-draft-card/event-draft-card";
import type { EventDraftTimelineState } from "@/lib/timeline";
import type { TimelineMessage, UpdateEventDraftInput } from "@/types/messages";
import { Ban, CheckCircle2 } from "lucide-react";
import { memo } from "react";

import { AssistantMark } from "./assistant-mark";
import type { DisplayTextMessage } from "./use-life-inbox";

interface TimelineMessageItemProps {
  message: TimelineMessage | DisplayTextMessage;
  draftState?: EventDraftTimelineState;
  actionsDisabled: boolean;
  onSave: (draftId: string, input: UpdateEventDraftInput) => Promise<void>;
  onConfirm: (draftId: string) => Promise<void>;
  onReject: (draftId: string) => Promise<void>;
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

export const TimelineMessageItem = memo(function TimelineMessageItem({
  message,
  draftState,
  actionsDisabled,
  onSave,
  onConfirm,
  onReject,
}: TimelineMessageItemProps) {
  if (message.kind === "text") {
    const time = formatMessageTime(message.createdAt);

    if (message.role === "user") {
      return (
        <article className="flex justify-end" aria-label="Your message">
          <div className="max-w-[88%] rounded-[20px] rounded-br-md bg-foreground px-4 py-3 text-[15px] text-background shadow-[0_1px_2px_rgba(35,31,24,0.12)] sm:max-w-[76%]">
            <p className="whitespace-pre-wrap break-words leading-7 text-pretty">
              {message.content}
            </p>
            <div className="mt-1.5 flex items-center justify-end gap-2 text-[11px] text-background/65">
              {"delivery" in message && message.delivery ? (
                <span>{message.delivery === "sending" ? "Sending" : "Status unknown"}</span>
              ) : null}
              {time ? <time dateTime={message.createdAt}>{time}</time> : null}
            </div>
          </div>
        </article>
      );
    }

    return (
      <article className="flex items-start gap-3" aria-label="LifeInbox message">
        <AssistantMark />
        <div className="min-w-0 flex-1 pt-1">
          <p className="max-w-[65ch] whitespace-pre-wrap break-words text-[15px] leading-7 text-foreground text-pretty">
            {message.content}
          </p>
          {time ? (
            <time
              dateTime={message.createdAt}
              className="mt-2 block text-[11px] text-muted-foreground"
            >
              {time}
            </time>
          ) : null}
        </div>
      </article>
    );
  }

  if (message.kind === "event_confirm" || message.kind === "event_reject") {
    const confirmed = message.kind === "event_confirm";
    const Icon = confirmed ? CheckCircle2 : Ban;

    return (
      <article
        className="flex justify-end"
        aria-label={confirmed ? "Event confirmed" : "Event rejected"}
      >
        <div
          className={`flex max-w-[88%] items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium ${confirmed ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-950"}`}
        >
          <Icon className="size-4" aria-hidden="true" />
          {confirmed ? "You confirmed this Event" : "You rejected this Event"}
        </div>
      </article>
    );
  }

  if (!draftState) return null;

  return (
    <article className="flex items-start gap-3" aria-label="Event draft interaction">
      <AssistantMark />
      <div className="min-w-0 flex-1">
        <EventDraftCard
          payload={message.payload}
          state={draftState}
          isLatestSnapshot={draftState.latestSnapshotId === message.id}
          source={message.kind === "event_edit" ? "user_edit" : "agent"}
          actionsDisabled={actionsDisabled}
          onSave={onSave}
          onConfirm={onConfirm}
          onReject={onReject}
        />
      </div>
    </article>
  );
}, areTimelineMessageItemPropsEqual);

function areTimelineMessageItemPropsEqual(
  previous: TimelineMessageItemProps,
  next: TimelineMessageItemProps,
) {
  if (
    previous.message !== next.message ||
    previous.draftState !== next.draftState ||
    previous.onSave !== next.onSave ||
    previous.onConfirm !== next.onConfirm ||
    previous.onReject !== next.onReject
  ) {
    return false;
  }

  const isEventDraft =
    previous.message.kind === "event_card" || previous.message.kind === "event_edit";

  return !isEventDraft || previous.actionsDisabled === next.actionsDisabled;
}
