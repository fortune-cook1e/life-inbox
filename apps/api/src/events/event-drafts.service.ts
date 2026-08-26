import { Injectable } from "@nestjs/common";

import { normalizeTimeZone } from "../common/time";
import { EventDraftIntakeRepository } from "./event-draft-intake.repository";
import { EventDraftTransitionsRepository } from "./event-draft-transitions.repository";
import {
  createPendingEventDraftInputSchema,
  updateEventDraftInputSchema,
  type CreatePendingEventDraftRecord,
  type CreatePendingEventDraftInput,
  type EventDraftConfirmationResult,
  type EventDraftEditResult,
  type EventDraftRejectionResult,
  type PendingEventDraftCreationResult,
  type UpdateEventDraftInput,
} from "./event-drafts.types";

@Injectable()
export class EventDraftsService {
  constructor(
    private readonly intakeRepository: EventDraftIntakeRepository,
    private readonly transitionsRepository: EventDraftTransitionsRepository,
  ) {}

  async createPendingDraftWithInitialCard(
    input: CreatePendingEventDraftInput,
  ): Promise<PendingEventDraftCreationResult> {
    const record = this.preparePendingDraft(input);

    return this.intakeRepository.createPendingDraftWithInitialCard(record);
  }

  private preparePendingDraft(input: CreatePendingEventDraftInput): CreatePendingEventDraftRecord {
    const validatedInput = createPendingEventDraftInputSchema.parse(input);

    const timezone = normalizeTimeZone(
      validatedInput.event.timezone ?? validatedInput.defaultTimezone,
    );

    return {
      sourceMessageId: validatedInput.sourceMessageId,
      title: validatedInput.event.title,
      startAt: validatedInput.event.startAt,
      endAt: validatedInput.event.endAt,
      timezone,
      location: validatedInput.event.location,
      description: validatedInput.event.description,
    };
  }

  async editDraft(draftId: string, input: UpdateEventDraftInput): Promise<EventDraftEditResult> {
    const changes = updateEventDraftInputSchema.parse(input);
    const normalizedChanges =
      changes.timezone === undefined
        ? changes
        : {
            ...changes,
            timezone: normalizeTimeZone(changes.timezone),
          };

    return this.transitionsRepository.editPendingDraft(draftId, normalizedChanges);
  }

  async confirmDraft(draftId: string): Promise<EventDraftConfirmationResult> {
    return this.transitionsRepository.confirmPendingDraft(draftId);
  }

  async rejectDraft(draftId: string): Promise<EventDraftRejectionResult> {
    return this.transitionsRepository.rejectPendingDraft(draftId);
  }
}
