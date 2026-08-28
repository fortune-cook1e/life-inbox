import type { EventDraftTimelineState } from "@/lib/timeline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { EventDraftPayload } from "@/types/messages";
import {
  AlertCircle,
  Ban,
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
  MapPin,
  Pencil,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatLocalDateTime } from "./event-draft-card.utils";

export type DraftAction = "saving" | "confirming" | "rejecting" | null;

interface EventDraftPreviewProps {
  payload: EventDraftPayload;
  state: EventDraftTimelineState;
  isLatestSnapshot: boolean;
  source: "agent" | "user_edit";
  showsActions: boolean;
  actionsDisabled: boolean;
  isComplete: boolean;
  statusLabel: string;
  action: DraftAction;
  error: string | null;
  onEdit: () => void;
  onConfirm: () => void;
  onReject: () => void;
}

export function EventDraftPreview({
  payload,
  state,
  isLatestSnapshot,
  source,
  showsActions,
  actionsDisabled,
  isComplete,
  statusLabel,
  action,
  error,
  onEdit,
  onConfirm,
  onReject,
}: EventDraftPreviewProps) {
  const [confirmReject, setConfirmReject] = useState(false);
  const rejectCancelRef = useRef<HTMLButtonElement>(null);
  const rejectTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmReject) rejectCancelRef.current?.focus();
  }, [confirmReject]);

  return (
    <section aria-label="Calendar event draft" className="mt-4">
      <Card className="gap-0 rounded-[20px] py-0 shadow-[0_1px_3px_rgba(35,31,24,0.12),0_12px_32px_rgba(35,31,24,0.06)] ring-0">
        <CardHeader className="flex flex-col items-stretch gap-3 rounded-t-[20px] bg-accent/55 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <CalendarDays className="size-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                {source === "user_edit" ? "Updated calendar draft" : "Calendar draft"}
              </p>
              <h2 className="mt-0.5 text-pretty text-[15px] font-semibold text-foreground">
                {payload.title ?? "Title needed"}
              </h2>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={`h-auto self-start px-2.5 py-1 text-[11px] font-semibold ${state.status === "rejected" && isLatestSnapshot ? "bg-rose-100 text-rose-900" : state.status === "confirmed" && isLatestSnapshot ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
          >
            {statusLabel}
          </Badge>
        </CardHeader>

        <CardContent className="px-0">
          <dl className="grid gap-3 px-4 py-4 text-sm sm:grid-cols-2 sm:px-5">
            <div className="flex gap-2.5 sm:col-span-2">
              <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="text-xs font-medium text-muted-foreground">When</dt>
                <dd className="mt-0.5 text-foreground">
                  {payload.startAt ? formatLocalDateTime(payload.startAt) : "Date and time needed"}
                </dd>
                {payload.endAt ? (
                  <dd className="mt-0.5 text-xs text-muted-foreground">
                    Ends {formatLocalDateTime(payload.endAt)}
                  </dd>
                ) : null}
              </div>
            </div>
            {payload.location ? (
              <div className="flex gap-2.5 sm:col-span-2">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Location</dt>
                  <dd className="mt-0.5 text-foreground">{payload.location}</dd>
                </div>
              </div>
            ) : null}
            {payload.description ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">Notes</dt>
                <dd className="mt-0.5 whitespace-pre-wrap leading-6 text-foreground">
                  {payload.description}
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>

        <CardFooter className="block rounded-b-[20px] bg-transparent px-4 py-3 sm:px-5">
          <p className="text-xs leading-5 text-muted-foreground">
            {state.status === "confirmed" && isLatestSnapshot
              ? "Confirmed as an Event."
              : state.status === "rejected" && isLatestSnapshot
                ? "This draft was rejected."
                : `Draft only. Timezone: ${payload.timezone}.`}
          </p>

          {showsActions ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {confirmReject ? (
                <>
                  <span className="mr-1 text-sm font-medium text-foreground">
                    Reject this draft?
                  </span>
                  <Button
                    ref={rejectCancelRef}
                    type="button"
                    variant="secondary"
                    size="touch"
                    onClick={() => {
                      setConfirmReject(false);
                      requestAnimationFrame(() => rejectTriggerRef.current?.focus());
                    }}
                    disabled={actionsDisabled || action !== null}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="touch"
                    onClick={onReject}
                    disabled={actionsDisabled || action !== null}
                  >
                    {action === "rejecting" ? (
                      <LoaderCircle
                        className="size-4 motion-safe:animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Ban className="size-4" aria-hidden="true" />
                    )}
                    Reject event
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="touch"
                    onClick={onEdit}
                    disabled={actionsDisabled || action !== null}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="touch"
                    onClick={onConfirm}
                    disabled={actionsDisabled || action !== null || !isComplete}
                    title={!isComplete ? "Add a title and start time before confirming" : undefined}
                  >
                    {action === "confirming" ? (
                      <LoaderCircle
                        className="size-4 motion-safe:animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Check className="size-4" aria-hidden="true" />
                    )}
                    Confirm
                  </Button>
                  <Button
                    ref={rejectTriggerRef}
                    type="button"
                    variant="ghost"
                    size="touch"
                    onClick={() => setConfirmReject(true)}
                    disabled={actionsDisabled || action !== null}
                    className="text-destructive [@media(hover:hover)]:hover:bg-destructive/10 [@media(hover:hover)]:hover:text-destructive"
                  >
                    Reject
                  </Button>
                </>
              )}
            </div>
          ) : null}
          {error ? (
            <Alert variant="destructive" className="mt-3">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardFooter>
      </Card>
    </section>
  );
}
