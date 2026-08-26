import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";
import { eventDrafts, type EventDraftRow, type NewEventDraftRow } from "../database/schemas";

export type CreateEventDraftRecord = Pick<
  NewEventDraftRow,
  | "sourceMessageId"
  | "status"
  | "title"
  | "startAt"
  | "endAt"
  | "timezone"
  | "location"
  | "description"
>;

@Injectable()
export class EventDraftsRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: CreateEventDraftRecord): Promise<EventDraftRow> {
    const [draft] = await this.database.db.insert(eventDrafts).values(input).returning();

    if (draft === undefined) {
      throw new Error("Event Draft insert returned no row.");
    }

    return draft;
  }
}
