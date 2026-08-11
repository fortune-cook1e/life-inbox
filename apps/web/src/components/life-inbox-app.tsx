"use client";

import {
  fetchRecentMessages,
  isPersistedAgentError,
  MessagesApiError,
  sendMessage,
  type CalendarEvent,
  type ChatMessage,
} from "@/lib/messages-api";
import {
  AlertCircle,
  ArrowUp,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
  MapPin,
  RefreshCw,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type ConnectionState = "checking" | "connected" | "offline";
type DeliveryState = "sending" | "saved" | "uncertain";

type DisplayMessage = ChatMessage & {
  delivery?: DeliveryState;
};

type ConversationNotice = {
  tone: "info" | "error";
  title: string;
  description: string;
};

const RECENT_MESSAGE_LIMIT = 100;
const CONNECTION_META: Record<ConnectionState, { label: string; dotClassName: string }> = {
  checking: {
    label: "Checking connection",
    dotClassName: "bg-amber-500 motion-safe:animate-pulse",
  },
  connected: {
    label: "Connected",
    dotClassName: "bg-emerald-600",
  },
  offline: {
    label: "API unavailable",
    dotClassName: "bg-rose-600",
  },
};

function createClientMessageId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getCurrentTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function formatMessageTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatEventDate(
  value: string,
  precision: CalendarEvent["startAtPrecision"],
  timeZone: string | null,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(precision === "DATE_TIME"
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
    ...(timeZone ? { timeZone } : {}),
  };

  try {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      ...(precision === "DATE_TIME"
        ? {
            hour: "2-digit",
            minute: "2-digit",
          }
        : {}),
    }).format(date);
  }
}

function EventPreview({ event }: { event: CalendarEvent }) {
  const isReady = event.status === "READY";
  const startLabel = event.startAt
    ? formatEventDate(event.startAt, event.startAtPrecision, event.timeZone)
    : "Date and time needed";
  const endLabel = event.endAt
    ? formatEventDate(event.endAt, event.endAtPrecision, event.timeZone)
    : null;

  return (
    <section
      aria-label="Calendar event draft"
      className="mt-4 overflow-hidden rounded-[20px] bg-card shadow-[0_1px_3px_rgba(35,31,24,0.12),0_12px_32px_rgba(35,31,24,0.06)]"
    >
      <div className="flex flex-col items-stretch gap-3 bg-accent/55 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CalendarDays className="size-4.5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Calendar draft</p>
            <h2 className="mt-0.5 text-pretty text-[15px] font-semibold text-foreground">
              {event.title ?? "Title needed"}
            </h2>
          </div>
        </div>
        <span
          className={`self-start rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            isReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
          }`}
        >
          {isReady ? "Ready for review" : "Needs details"}
        </span>
      </div>

      <dl className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5">
        <div className="flex gap-2.5 sm:col-span-2">
          <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <dt className="text-xs font-medium text-muted-foreground">When</dt>
            <dd className="mt-0.5 text-foreground">
              {startLabel}
              {event.startAtPrecision === "DATE_ONLY" ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Time still needed
                </span>
              ) : null}
            </dd>
            {endLabel ? (
              <dd className="mt-0.5 text-xs text-muted-foreground">Ends {endLabel}</dd>
            ) : null}
          </div>
        </div>

        {event.location ? (
          <div className="flex gap-2.5 sm:col-span-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Location</dt>
              <dd className="mt-0.5 text-foreground">{event.location}</dd>
            </div>
          </div>
        ) : null}
      </dl>

      <p className="border-t border-border/70 px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-5">
        Draft only. Nothing has been added to your calendar.
        {event.timeZone ? ` Time zone: ${event.timeZone}.` : ""}
      </p>
    </section>
  );
}

function MessageRow({ message, event }: { message: DisplayMessage; event?: CalendarEvent }) {
  const isUser = message.role === "USER";
  const time = formatMessageTime(message.createdAt);

  if (isUser) {
    return (
      <article className="flex justify-end" aria-label="Your message">
        <div className="max-w-[88%] rounded-[20px] rounded-br-md bg-foreground px-4 py-3 text-[15px] text-background shadow-[0_1px_2px_rgba(35,31,24,0.12)] sm:max-w-[76%]">
          <p className="whitespace-pre-wrap break-words leading-7 text-pretty">{message.content}</p>
          <div className="mt-1.5 flex items-center justify-end gap-2 text-[11px] text-background/65">
            {message.delivery ? (
              <span>
                {message.delivery === "sending"
                  ? "Sending"
                  : message.delivery === "saved"
                    ? "Saved, assistant stopped"
                    : "Status unknown"}
              </span>
            ) : null}
            {time ? <time dateTime={message.createdAt}>{time}</time> : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex items-start gap-3" aria-label="LifeInbox message">
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(35,31,24,0.12)]">
        <Check className="size-4" strokeWidth={2.4} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <p className="max-w-[65ch] whitespace-pre-wrap break-words text-[15px] leading-7 text-foreground text-pretty">
          {message.content}
        </p>
        {event ? <EventPreview event={event} /> : null}
        {!event && message.kind === "EVENT_PREVIEW" ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Event details are not included in message history.
          </p>
        ) : null}
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

function ProcessingRow() {
  return (
    <div
      className="flex items-center gap-3 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
        <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
      </div>
      <span>Working through the next step</span>
    </div>
  );
}

function EmptyConversation() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center sm:py-24">
      <div className="grid size-12 place-items-center rounded-[18px] bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(39,75,52,0.18)]">
        <Check className="size-6" strokeWidth={2.4} aria-hidden="true" />
      </div>
      <h2 className="mt-6 text-balance text-2xl font-semibold tracking-[-0.012em] text-foreground sm:text-[28px]">
        What should I remember?
      </h2>
      <p className="mt-3 text-pretty text-sm leading-6 text-muted-foreground">
        Tell me about an appointment, deadline, or reminder. If a date or time is missing, I will
        ask one question at a time.
      </p>
    </div>
  );
}

function Notice({
  notice,
  showReload,
  onReload,
  reloading,
}: {
  notice: ConversationNotice;
  showReload: boolean;
  onReload: () => void;
  reloading: boolean;
}) {
  return (
    <div
      role={notice.tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm ${
        notice.tone === "error" ? "bg-rose-50 text-rose-950" : "bg-accent/65 text-accent-foreground"
      }`}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{notice.title}</p>
        <p className="mt-0.5 max-w-[65ch] leading-5 opacity-75">{notice.description}</p>
      </div>
      {showReload ? (
        <button
          type="button"
          onClick={onReload}
          disabled={reloading}
          className="min-h-10 shrink-0 touch-manipulation rounded-xl px-3 font-semibold transition-[background-color,transform,opacity] [@media(hover:hover)]:hover:bg-black/5 active:scale-[0.96] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50"
        >
          Reload
        </button>
      ) : null}
    </div>
  );
}

export function LifeInboxApp() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [eventsByMessageId, setEventsByMessageId] = useState<Record<string, CalendarEvent>>({});
  const [draft, setDraft] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [notice, setNotice] = useState<ConversationNotice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const endOfConversationRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const unknownDeliveryContentRef = useRef<string | null>(null);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    setConnection("checking");

    try {
      const page = await fetchRecentMessages(RECENT_MESSAGE_LIMIT);
      setMessages(page.items);
      setConnection("connected");
      setRefreshRequired(false);
      const unknownContent = unknownDeliveryContentRef.current;

      if (unknownContent) {
        setDraft(unknownContent);
        unknownDeliveryContentRef.current = null;
        setNotice({
          tone: "info",
          title: "Check before sending again",
          description:
            "Your text is restored in the composer. If it already appears above, clear it instead of sending it again.",
        });
      } else {
        setNotice(null);
      }
    } catch (error) {
      setConnection("offline");
      setNotice({
        tone: "error",
        title: "Conversation unavailable",
        description:
          error instanceof MessagesApiError
            ? error.message
            : "LifeInbox could not load the conversation. Check the API and reload.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void fetchRecentMessages({
      limit: RECENT_MESSAGE_LIMIT,
      signal: controller.signal,
    })
      .then((page) => {
        setMessages(page.items);
        setConnection("connected");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setConnection("offline");
        setNotice({
          tone: "error",
          title: "Conversation unavailable",
          description:
            error instanceof MessagesApiError
              ? error.message
              : "LifeInbox could not load the conversation. Check the API and reload.",
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    endOfConversationRef.current?.scrollIntoView({ block: "end" });
  }, [isLoading, isSubmitting, messages.length, notice]);

  function markSubmissionUnknown(optimisticMessage: DisplayMessage, content: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === optimisticMessage.id ? { ...message, delivery: "uncertain" } : message,
      ),
    );
    unknownDeliveryContentRef.current = content;
    setConnection("offline");
    setRefreshRequired(true);
    setNotice({
      tone: "error",
      title: "Delivery status unknown",
      description:
        "LifeInbox could not confirm whether this message was saved. Reload the conversation before sending another message.",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draft.trim();
    if (!content || isSubmitting || isLoading || refreshRequired || content.length > 10_000) {
      return;
    }

    const clientMessageId = createClientMessageId();
    const optimisticMessage: DisplayMessage = {
      id: `optimistic-${clientMessageId}`,
      role: "USER",
      kind: "USER_TEXT",
      content,
      createdAt: new Date().toISOString(),
      delivery: "sending",
    };

    setMessages((current) => [...current, optimisticMessage]);
    setDraft("");
    setNotice(null);
    setIsSubmitting(true);

    try {
      const response = await sendMessage({
        clientMessageId,
        content,
        timeZone: getCurrentTimeZone(),
      });

      setMessages((current) => {
        const responseIds = new Set([response.message.id, response.assistantMessage?.id]);
        const withoutDuplicates = current.filter(
          (message) => message.id !== optimisticMessage.id && !responseIds.has(message.id),
        );

        return [
          ...withoutDuplicates,
          response.message,
          ...(response.assistantMessage ? [response.assistantMessage] : []),
        ];
      });

      if (response.assistantMessage && response.event) {
        setEventsByMessageId((current) => ({
          ...current,
          [response.assistantMessage!.id]: response.event!,
        }));
      }

      setConnection("connected");
      setRefreshRequired(false);

      if (response.outcome === "MESSAGE_ONLY") {
        setNotice({
          tone: "info",
          title: "Saved without a calendar draft",
          description:
            "LifeInbox kept the message, but no appointment, deadline, or reminder was created.",
        });
      }
    } catch (error) {
      if (error instanceof MessagesApiError && error.status === 400) {
        setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
        setDraft(content);
        setNotice({
          tone: "error",
          title: "Message needs attention",
          description: error.message,
        });
      } else if (isPersistedAgentError(error)) {
        try {
          const page = await fetchRecentMessages(RECENT_MESSAGE_LIMIT);
          setMessages(page.items);
          setConnection("connected");
        } catch {
          setMessages((current) =>
            current.map((message) =>
              message.id === optimisticMessage.id ? { ...message, delivery: "saved" } : message,
            ),
          );
        }

        setNotice({
          tone: "error",
          title: "Assistant response incomplete",
          description:
            "Your message was saved, but the assistant did not finish. It was not sent again.",
        });
      } else {
        markSubmissionUnknown(optimisticMessage, content);
      }
    } finally {
      setIsSubmitting(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const connectionMeta = CONNECTION_META[connection];
  const canSend =
    draft.trim().length > 0 &&
    draft.trim().length <= 10_000 &&
    !isSubmitting &&
    !isLoading &&
    !refreshRequired;

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-foreground px-3 py-2 text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to conversation
      </a>

      <header className="shrink-0 border-b border-border/80 bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-4">LifeInbox</h1>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Calendar assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div
              className="hidden items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground sm:flex"
              role="status"
            >
              <span
                className={`size-1.5 rounded-full ${connectionMeta.dotClassName}`}
                aria-hidden="true"
              />
              {connectionMeta.label}
            </div>
            <button
              type="button"
              onClick={() => void loadMessages()}
              disabled={isLoading || isSubmitting}
              aria-label="Reload conversation"
              className="grid size-10 touch-manipulation place-items-center rounded-xl text-muted-foreground transition-[background-color,color,transform,opacity] [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground active:scale-[0.96] active:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-45"
            >
              <RefreshCw
                className={`size-4 ${isLoading ? "motion-safe:animate-spin" : ""}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pt-6 pb-8 sm:px-6 sm:pt-10">
          {isLoading && messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted-foreground">
              <LoaderCircle className="mr-2 size-4 motion-safe:animate-spin" aria-hidden="true" />
              Loading conversation
            </div>
          ) : messages.length === 0 ? (
            <EmptyConversation />
          ) : (
            <div
              className="space-y-7 sm:space-y-8"
              role="log"
              aria-label="Conversation"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {messages.map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  event={eventsByMessageId[message.id]}
                />
              ))}
              {isSubmitting ? <ProcessingRow /> : null}
            </div>
          )}

          {notice ? (
            <div className="mt-7">
              <Notice
                notice={notice}
                showReload={refreshRequired}
                onReload={() => void loadMessages()}
                reloading={isLoading}
              />
            </div>
          ) : null}

          <div ref={endOfConversationRef} className="h-px" aria-hidden="true" />
        </div>
      </main>

      <div className="shrink-0 border-t border-border/70 bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-4">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl" aria-label="Send a message">
          <div className="rounded-[20px] bg-card p-2 shadow-[0_1px_3px_rgba(35,31,24,0.14),0_14px_38px_rgba(35,31,24,0.08)] transition-[box-shadow] focus-within:ring-3 focus-within:ring-ring/35 motion-reduce:transition-none">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={isSubmitting || isLoading || refreshRequired}
              maxLength={10_000}
              rows={1}
              aria-label="Message LifeInbox"
              aria-describedby="composer-hint"
              placeholder={
                refreshRequired
                  ? "Reload the conversation to continue"
                  : "Tell LifeInbox what you need to remember"
              }
              className="field-sizing-content max-h-40 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:text-[15px]"
            />
            <div className="flex items-center justify-between gap-3 pl-3">
              <p id="composer-hint" className="text-[11px] text-muted-foreground">
                {draft.length > 9_000
                  ? `${draft.length.toLocaleString()} / 10,000`
                  : "Enter to send, Shift+Enter for a new line"}
              </p>
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Send message"
                className="grid size-10 shrink-0 touch-manipulation place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(35,31,24,0.16)] transition-[background-color,transform,opacity] [@media(hover:hover)]:hover:bg-primary/90 active:scale-[0.96] active:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {isSubmitting ? (
                  <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowUp className="size-4.5" strokeWidth={2.4} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <p className="mt-2 px-2 text-center text-[11px] leading-4 text-muted-foreground">
            Drafts only. Your calendar stays unchanged.
          </p>
        </form>
      </div>
    </div>
  );
}
