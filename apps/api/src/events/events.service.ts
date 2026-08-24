import { Injectable } from "@nestjs/common";

import type { EventDraftRow } from "../database/schemas";
import { EventDraftsRepository } from "./event-drafts.repository";
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
  constructor(private readonly eventDraftsRepository: EventDraftsRepository) {}

  async createPendingDraft(input: CreatePendingEventDraftInput): Promise<EventDraftRow> {
    const validatedInput = createPendingEventDraftInputSchema.parse(input);

    const timezone = normalizeTimeZone(
      validatedInput.event.timezone ?? validatedInput.defaultTimezone,
    );

    return this.eventDraftsRepository.create({
      sourceMessageId: validatedInput.sourceMessageId,
      status: "pending",
      title: validatedInput.event.title,
      startAt: validatedInput.event.startAt,
      endAt: validatedInput.event.endAt,
      timezone,
      location: validatedInput.event.location,
      description: validatedInput.event.description,
    });
  }
}
