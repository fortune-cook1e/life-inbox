import { AIMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import {
  API_SUCCESS_CODE,
  API_SUCCESS_MESSAGE,
  ApiErrorCode,
  type ApiErrorEnvelope,
  type ApiSuccessEnvelope,
} from "@life-inbox/shared";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { EVENT_AGENT_MODEL } from "../src/agents/event-agent/event-agent-model.provider";
import { AppModule } from "../src/app.module";
import { DatabaseService } from "../src/database/database.service";
import { eventDrafts, messages } from "../src/database/schemas";
import type {
  MessageResponse,
  MessageTurnResponse,
} from "../src/messages/messages.types";

describe("Messages HTTP workflow", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let database: DatabaseService;

  const createdMessageIds: string[] = [];
  const createdDraftIds: string[] = [];

  beforeAll(async () => {
    const model = fakeModel()
      .respondWithTools([
        {
          name: "create_event_draft",
          args: {
            title: "Meet Anna",
            startAt: "2026-08-27T15:00:00",
            endAt: null,
            timezone: null,
            location: "Stockholm University",
            description: null,
          },
        },
      ])
      .respond(new AIMessage("The Event Draft is ready for review."));

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EVENT_AGENT_MODEL)
      .useValue(model)
      .compile();

    database = moduleRef.get(DatabaseService);

    app = moduleRef.createNestApplication({
      logger: false,
    });

    // main.ts is not executed by createNestApplication().
    app.setGlobalPrefix("api");

    await app.listen(0, "127.0.0.1");
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
    await app.close();
  });

  it("creates and replays a persisted Event Card", async () => {
    const response = await fetch(`${await app.getUrl()}/api/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        content: "Meet Anna tomorrow at 3 PM at Stockholm University.",
        timezone: "Europe/Stockholm",
      }),
    });

    expect(response.status).toBe(201);

    const envelope = (await response.json()) as ApiSuccessEnvelope<MessageTurnResponse>;

    expect(envelope.code).toBe(API_SUCCESS_CODE);
    expect(envelope.message).toBe(API_SUCCESS_MESSAGE);

    const { userMessage, assistantMessage: eventCardMessage } = envelope.data;

    expect(userMessage).toMatchObject({
      role: "user",
      kind: "text",
      content: "Meet Anna tomorrow at 3 PM at Stockholm University.",
    });

    expect(eventCardMessage).toMatchObject({
      role: "assistant",
      kind: "event_card",
      payload: {
        title: "Meet Anna",
        startAt: "2026-08-27T15:00:00",
        endAt: null,
        timezone: "Europe/Stockholm",
        location: "Stockholm University",
        description: null,
      },
    });

    if (eventCardMessage.kind !== "event_card") {
      throw new Error("Expected an Event Card response.");
    }

    createdMessageIds.push(userMessage.id, eventCardMessage.id);
    createdDraftIds.push(eventCardMessage.payload.draftId);

    const persistedDraft = await database.db.query.eventDrafts.findFirst({
      where: eq(eventDrafts.id, eventCardMessage.payload.draftId),
    });

    expect(persistedDraft).toMatchObject({
      id: eventCardMessage.payload.draftId,
      sourceMessageId: userMessage.id,
      status: "pending",
      title: "Meet Anna",
      timezone: "Europe/Stockholm",
      location: "Stockholm University",
    });

    const historyResponse = await fetch(`${await app.getUrl()}/api/messages`);

    expect(historyResponse.status).toBe(200);

    const historyEnvelope = (await historyResponse.json()) as ApiSuccessEnvelope<
      MessageResponse[]
    >;

    expect(historyEnvelope.code).toBe(API_SUCCESS_CODE);
    expect(historyEnvelope.message).toBe(API_SUCCESS_MESSAGE);

    const history = historyEnvelope.data;
    const userIndex = history.findIndex((message) => message.id === userMessage.id);
    const eventCardIndex = history.findIndex((message) => message.id === eventCardMessage.id);

    expect(userIndex).toBeGreaterThanOrEqual(0);
    expect(eventCardIndex).toBe(userIndex + 1);
    expect(history.slice(userIndex, eventCardIndex + 1)).toEqual([
      userMessage,
      eventCardMessage,
    ]);
  });

  it("rejects an invalid timezone before persisting the user message", async () => {
    const content = "Meet Anna tomorrow in Mars time.";

    const response = await fetch(`${await app.getUrl()}/api/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        content,
        timezone: "Mars/Olympus",
      }),
    });

    expect(response.status).toBe(400);

    const errorEnvelope = (await response.json()) as ApiErrorEnvelope;

    expect(errorEnvelope).toEqual({
      code: ApiErrorCode.ValidationError,
      data: null,
      message: "Timezone must be a valid IANA timezone identifier.",
    });

    const accidentallyPersistedMessages = await database.db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.content, content));

    createdMessageIds.push(...accidentallyPersistedMessages.map((message) => message.id));

    expect(accidentallyPersistedMessages).toHaveLength(0);
  });
});
