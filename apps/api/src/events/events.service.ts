import { Injectable } from "@nestjs/common";

import type { EventDraftRow } from "../database/schemas";
import {
  EventDraftsRepository,
  type CreateEventDraftRecord,
} from "./event-drafts.repository";
import {
  EventIntakeRepository,
  type EventIntakeResult,
} from "./event-intake.repository";
import {
  createPendingEventDraftInputSchema,
  type CreatePendingEventDraftInput,
} from "./events.schema";

function normalizeTimeZone(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: value.trim(),
    }).resolvedOptions().timeZone;
  } catch {
    throw new Error("Invalid Event Draft timezone.");
  }
}

@Injectable()
export class EventsService {
  constructor(
    private readonly eventDraftsRepository: EventDraftsRepository,
    private readonly eventIntakeRepository: EventIntakeRepository,
  ) {}

  async createPendingDraft(input: CreatePendingEventDraftInput): Promise<EventDraftRow> {
    const record = this.preparePendingDraft(input);

    return this.eventDraftsRepository.create(record);
  }

  async createPendingDraftWithInitialCard(
    input: CreatePendingEventDraftInput,
  ): Promise<EventIntakeResult> {
    const record = this.preparePendingDraft(input);

    return this.eventIntakeRepository.createPendingDraftWithInitialCard(record);
  }

  private preparePendingDraft(input: CreatePendingEventDraftInput): CreateEventDraftRecord {
    const validatedInput = createPendingEventDraftInputSchema.parse(input);

    const timezone = normalizeTimeZone(
      validatedInput.event.timezone ?? validatedInput.defaultTimezone,
    );

    return {
      sourceMessageId: validatedInput.sourceMessageId,
      status: "pending",
      title: validatedInput.event.title,
      startAt: validatedInput.event.startAt,
      endAt: validatedInput.event.endAt,
      timezone,
      location: validatedInput.event.location,
      description: validatedInput.event.description,
    };
  }
}
