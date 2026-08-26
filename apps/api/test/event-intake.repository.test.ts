import { Test, type TestingModule } from "@nestjs/testing";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { DatabaseModule } from "../src/database/database.module";
import { DatabaseService } from "../src/database/database.service";
import { eventDrafts, messages } from "../src/database/schemas";
import { EventIntakeRepository } from "../src/events/event-intake.repository";

describe("EventIntakeRepository", () => {
  let moduleRef: TestingModule | undefined;
  let database: DatabaseService;
  let repository: EventIntakeRepository;

  const createdMessageIds: string[] = [];
  const createdDraftIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [EventIntakeRepository],
    }).compile();

    database = moduleRef.get(DatabaseService);
    repository = moduleRef.get(EventIntakeRepository);
  });

  afterEach(async () => {
    if (createdDraftIds.length > 0) {
      await database.db.delete(eventDrafts).where(inArray(eventDrafts.id, createdDraftIds));
    }

    if (createdMessageIds.length > 0) {
      await database.db.delete(messages).where(inArray(messages.id, createdMessageIds));
    }

    createdDraftIds.length = 0;
    createdMessageIds.length = 0;
  });

  afterAll(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
  });

  async function createSourceMessage(content: string): Promise<string> {
    const [message] = await database.db
      .insert(messages)
      .values({
        role: "user",
        kind: "text",
        content,
        payload: null,
      })
      .returning({
        id: messages.id,
      });

    if (message === undefined) {
      throw new Error("Source Message insert returned no row.");
    }

    createdMessageIds.push(message.id);

    return message.id;
  }

  it("atomically creates a pending Event Draft and its initial Event Card", async () => {
    const sourceMessageId = await createSourceMessage("Meet Anna tomorrow at 3 PM.");

    const result = await repository.createPendingDraftWithInitialCard({
      sourceMessageId,
      status: "pending",
      title: "Meet Anna",
      startAt: "2026-08-27T15:00:00",
      endAt: null,
      timezone: "Europe/Stockholm",
      location: null,
      description: null,
    });

    createdDraftIds.push(result.draft.id);
    createdMessageIds.push(result.eventCardMessage.id);

    expect(result.eventCardMessage).toMatchObject({
      role: "assistant",
      kind: "event_card",
      content: null,
      payload: {
        draftId: result.draft.id,
        title: "Meet Anna",
        startAt: "2026-08-27T15:00:00",
        endAt: null,
        timezone: "Europe/Stockholm",
        location: null,
        description: null,
      },
    });
  });

  it("rolls back the Draft when initial Event Card validation fails", async () => {
    const sourceMessageId = await createSourceMessage("Meet Anna tomorrow in Mars time.");

    await expect(
      repository.createPendingDraftWithInitialCard({
        sourceMessageId,
        status: "pending",
        title: "Meet Anna",
        startAt: "2026-08-27T15:00:00",
        endAt: null,
        timezone: "Mars/Olympus",
        location: null,
        description: null,
      }),
    ).rejects.toBeInstanceOf(ZodError);

    const persistedDrafts = await database.db
      .select()
      .from(eventDrafts)
      .where(eq(eventDrafts.sourceMessageId, sourceMessageId));

    expect(persistedDrafts).toHaveLength(0);
  });
});
