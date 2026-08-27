import { Test, type TestingModule } from "@nestjs/testing";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { DatabaseModule } from "../src/database/database.module";
import { DatabaseService } from "../src/database/database.service";
import { eventDrafts, messages } from "../src/database/schemas";
import { EventDraftIntakeRepository } from "../src/events/event-draft-intake.repository";

describe("EventDraftIntakeRepository", () => {
  let moduleRef: TestingModule | undefined;
  let database: DatabaseService;
  let repository: EventDraftIntakeRepository;

  const createdMessageIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [EventDraftIntakeRepository],
    }).compile();

    database = moduleRef.get(DatabaseService);
    repository = moduleRef.get(EventDraftIntakeRepository);
  });

  afterEach(async () => {
    if (createdMessageIds.length > 0) {
      await database.db
        .delete(eventDrafts)
        .where(inArray(eventDrafts.sourceMessageId, createdMessageIds));
      await database.db.delete(messages).where(inArray(messages.id, createdMessageIds));
    }

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

  it("rolls back the Draft when initial Event Card validation fails", async () => {
    const sourceMessageId = await createSourceMessage("Meet Anna tomorrow in Mars time.");

    await expect(
      repository.createPendingDraftWithInitialCard({
        sourceMessageId,
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
