import { eq, inArray } from "drizzle-orm";
import { Test, type TestingModule } from "@nestjs/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { DatabaseModule } from "../src/database/database.module";
import { DatabaseService } from "../src/database/database.service";
import { eventDrafts, messages } from "../src/database/schemas";
import { EventsModule } from "../src/events/events.module";
import { EventDraftsService } from "../src/events/event-drafts.service";

describe("EventDraftsService", () => {
  let moduleRef: TestingModule | undefined;
  let database: DatabaseService;
  let eventDraftsService: EventDraftsService;

  const sourceMessageIds: string[] = [];
  const createdMessageIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule, EventsModule],
    }).compile();

    database = moduleRef.get(DatabaseService);
    eventDraftsService = moduleRef.get(EventDraftsService);
  });

  afterEach(async () => {
    if (sourceMessageIds.length === 0) {
      return;
    }

    await database.db
      .delete(eventDrafts)
      .where(inArray(eventDrafts.sourceMessageId, sourceMessageIds));

    await database.db.delete(messages).where(inArray(messages.id, createdMessageIds));

    sourceMessageIds.length = 0;
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
        content,
      })
      .returning({
        id: messages.id,
      });

    if (message === undefined) {
      throw new Error("Source message insert returned no row.");
    }

    sourceMessageIds.push(message.id);
    createdMessageIds.push(message.id);

    return message.id;
  }

  it("creates a pending Event Draft using the default timezone", async () => {
    const sourceMessageId = await createSourceMessage("Meet Anna tomorrow at 3 PM.");

    const result = await eventDraftsService.createPendingDraftWithInitialCard({
      sourceMessageId,
      defaultTimezone: "Europe/Stockholm",
      event: {
        title: "Meet Anna",
        startAt: "2026-08-25T15:00:00",
        endAt: null,
        timezone: null,
        location: null,
        description: null,
      },
    });
    const draft = result.draft;
    createdMessageIds.push(result.eventCardMessage.id);

    expect(draft).toMatchObject({
      sourceMessageId,
      status: "pending",
      title: "Meet Anna",
      timezone: "Europe/Stockholm",
    });

    const persistedDrafts = await database.db
      .select()
      .from(eventDrafts)
      .where(eq(eventDrafts.sourceMessageId, sourceMessageId));

    expect(persistedDrafts).toHaveLength(1);
    expect(persistedDrafts[0]).toMatchObject({
      id: draft.id,
      sourceMessageId,
      status: "pending",
      timezone: "Europe/Stockholm",
    });
  });

  it("rejects an invalid explicit timezone without creating a Draft", async () => {
    const sourceMessageId = await createSourceMessage("Meet Anna tomorrow at 3 PM Mars time.");

    await expect(
      eventDraftsService.createPendingDraftWithInitialCard({
        sourceMessageId,
        defaultTimezone: "Europe/Stockholm",
        event: {
          title: "Meet Anna",
          startAt: "2026-08-25T15:00:00",
          endAt: null,
          timezone: "Mars/Olympus",
          location: null,
          description: null,
        },
      }),
    ).rejects.toThrow("Invalid Event Draft timezone.");

    const persistedDrafts = await database.db
      .select()
      .from(eventDrafts)
      .where(eq(eventDrafts.sourceMessageId, sourceMessageId));

    expect(persistedDrafts).toHaveLength(0);
  });

  it("finds an incomplete pending Draft and atomically persists its Agent update card", async () => {
    const sourceMessageId = await createSourceMessage("Meet Anna tomorrow.");
    const creation = await eventDraftsService.createPendingDraftWithInitialCard({
      sourceMessageId,
      defaultTimezone: "Europe/Stockholm",
      event: {
        title: "Meet Anna",
        startAt: null,
        endAt: null,
        timezone: null,
        location: null,
        description: null,
      },
    });
    createdMessageIds.push(creation.eventCardMessage.id);

    const contexts = await eventDraftsService.findIncompletePendingDraftContexts();
    expect(contexts).toContainEqual({
      draft: creation.draft,
      sourceMessageContent: "Meet Anna tomorrow.",
    });

    const update = await eventDraftsService.updatePendingDraftFromAgent(creation.draft.id, {
      startAt: "2026-08-28T15:00:00",
    });

    expect(update).toMatchObject({
      kind: "updated",
      draft: {
        id: creation.draft.id,
        startAt: "2026-08-28 15:00:00",
      },
      eventCardMessage: {
        role: "assistant",
        kind: "event_card",
        payload: {
          draftId: creation.draft.id,
          startAt: "2026-08-28T15:00:00",
        },
      },
    });

    if (update.kind === "updated") {
      createdMessageIds.push(update.eventCardMessage.id);
    }
  });
});
