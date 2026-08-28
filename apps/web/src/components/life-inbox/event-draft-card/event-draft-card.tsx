"use client";

import type { EventDraftTimelineState } from "@/lib/timeline";
import type { EventDraftPayload, UpdateEventDraftInput } from "@/types/messages";
import { useRef, useState } from "react";

import { EventDraftEditor } from "./event-draft-editor";
import { EventDraftPreview, type DraftAction } from "./event-draft-preview";

interface EventDraftCardProps {
  payload: EventDraftPayload;
  state: EventDraftTimelineState;
  isLatestSnapshot: boolean;
  source: "agent" | "user_edit";
  actionsDisabled: boolean;
  onSave: (draftId: string, input: UpdateEventDraftInput) => Promise<void>;
  onConfirm: (draftId: string) => Promise<void>;
  onReject: (draftId: string) => Promise<void>;
}

export function EventDraftCard({
  payload,
  state,
  isLatestSnapshot,
  source,
  actionsDisabled,
  onSave,
  onConfirm,
  onReject,
}: EventDraftCardProps) {
  const actionLockRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [action, setAction] = useState<DraftAction>(null);
  const [error, setError] = useState<string | null>(null);

  const showsActions = isLatestSnapshot && state.status === "pending";
  const isComplete = Boolean(
    state.payload.title?.trim() && state.payload.startAt && state.payload.timezone.trim(),
  );
  const statusLabel = !isLatestSnapshot
    ? "Earlier draft"
    : state.status === "confirmed"
      ? "Confirmed"
      : state.status === "rejected"
        ? "Rejected"
        : isComplete
          ? "Ready for review"
          : "Needs details";

  async function runAction(nextAction: Exclude<DraftAction, null>, operation: () => Promise<void>) {
    if (actionsDisabled || actionLockRef.current) return;

    actionLockRef.current = true;
    setAction(nextAction);
    setError(null);
    try {
      await operation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "LifeInbox could not save this action.");
    } finally {
      actionLockRef.current = false;
      setAction(null);
    }
  }

  if (isEditing) {
    return (
      <EventDraftEditor
        payload={payload}
        disabled={actionsDisabled}
        isSaving={action === "saving"}
        error={error}
        onCancel={() => setIsEditing(false)}
        onSave={(input) =>
          runAction("saving", async () => {
            await onSave(payload.draftId, input);
            setIsEditing(false);
          })
        }
      />
    );
  }

  return (
    <EventDraftPreview
      payload={payload}
      state={state}
      isLatestSnapshot={isLatestSnapshot}
      source={source}
      showsActions={showsActions}
      actionsDisabled={actionsDisabled}
      isComplete={isComplete}
      statusLabel={statusLabel}
      action={action}
      error={error}
      onEdit={() => setIsEditing(true)}
      onConfirm={() => void runAction("confirming", () => onConfirm(payload.draftId))}
      onReject={() => void runAction("rejecting", () => onReject(payload.draftId))}
    />
  );
}
