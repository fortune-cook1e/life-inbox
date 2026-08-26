import { Test, type TestingModule } from "@nestjs/testing";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { EventAgentService } from "../src/agents/event-agent/event-agent.service";
import { DatabaseModule } from "../src/database/database.module";
import { DatabaseService } from "../src/database/database.service";
import { messages, type MessageRow } from "../src/database/schemas";
import { EventsService } from "../src/events/events.service";
import { toMessageResponse } from "../src/messages/messages.mapper";
import { MessagesRepository } from "../src/messages/messages.repository";
import type { EventCardPayload } from "../src/messages/messages.types";
import { MessagesService } from "../src/messages/messages.service";

const payload = {
  draftId: "e18f2dc1-58b8-460d-aac8-7c906f5668f5",
  title: "Meet Anna",
  startAt: "2026-08-26T15:00:00",
  endAt: null,
  timezone: "Europe/Stockholm",
  location: null,
  description: null,
} satisfies EventCardPayload;

const eventCardRow: MessageRow = {
  id: "a9d0377a-37dc-4e92-a980-97ae626ed385",
  sequence: 2,
  role: "assistant",
  kind: "event_card",
  content: null,
  payload,
  createdAt: new Date("2026-08-25T12:00:00.000Z"),
};

describe("Event Card message application boundary", () => {
  let moduleRef: TestingModule | undefined;
  let messagesService: MessagesService;

  const messagesRepository = {
    createEventCardMessage: vi.fn(),
  };

  beforeEach(async () => {
    messagesRepository.createEventCardMessage.mockReset();

    moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: MessagesRepository,
          useValue: messagesRepository,
        },
        {
          provide: EventAgentService,
          useValue: {},
        },
        {
          provide: EventsService,
          useValue: {},
        },
      ],
    }).compile();

    messagesService = moduleRef.get(MessagesService);
  });

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
  });

  it("validates, delegates, and maps an Event Card message", async () => {
    messagesRepository.createEventCardMessage.mockResolvedValue(eventCardRow);

    const storedMessage = await messagesService.createEventCardMessage(payload);

    expect(messagesRepository.createEventCardMessage).toHaveBeenCalledWith(payload);

    expect(toMessageResponse(storedMessage)).toEqual({
      id: eventCardRow.id,
      role: "assistant",
      kind: "event_card",
      payload,
      createdAt: "2026-08-25T12:00:00.000Z",
    });
  });

  it("rejects an invalid Event Card payload before persistence or mapping", async () => {
    const invalidPayload = {
      ...payload,
      timezone: "Mars/Olympus",
    };

    await expect(
      messagesService.createEventCardMessage(invalidPayload as EventCardPayload),
    ).rejects.toBeInstanceOf(ZodError);

    expect(messagesRepository.createEventCardMessage).not.toHaveBeenCalled();

    expect(() =>
      toMessageResponse({
        ...eventCardRow,
        payload: invalidPayload,
      }),
    ).toThrow(ZodError);
  });

  it("maps an existing text message with an explicit discriminator", () => {
    const textMessage: MessageRow = {
      id: "0e05f5c5-79ae-45af-b68f-6eb2e63e49ea",
      sequence: 1,
      role: "user",
      kind: "text",
      content: "Meet Anna tomorrow at 3 PM.",
      payload: null,
      createdAt: new Date("2026-08-25T11:59:00.000Z"),
    };

    expect(toMessageResponse(textMessage)).toEqual({
      id: textMessage.id,
      role: "user",
      kind: "text",
      content: "Meet Anna tomorrow at 3 PM.",
      createdAt: "2026-08-25T11:59:00.000Z",
    });
  });
});

describe("Event Card message persistence", () => {
  let moduleRef: TestingModule | undefined;
  let database: DatabaseService;
  let messagesService: MessagesService;

  const createdMessageIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [
        MessagesService,
        MessagesRepository,
        {
          provide: EventAgentService,
          useValue: {},
        },
        {
          provide: EventsService,
          useValue: {},
        },
      ],
    }).compile();

    database = moduleRef.get(DatabaseService);
    messagesService = moduleRef.get(MessagesService);
  });

  afterEach(async () => {
    if (createdMessageIds.length === 0) {
      return;
    }

    await database.db.delete(messages).where(inArray(messages.id, createdMessageIds));
    createdMessageIds.length = 0;
  });

  afterAll(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
  });

  it("persists the validated assistant Event Card shape", async () => {
    const storedMessage = await messagesService.createEventCardMessage(payload);
    createdMessageIds.push(storedMessage.id);

    const persistedMessages = await database.db
      .select()
      .from(messages)
      .where(eq(messages.id, storedMessage.id));

    expect(persistedMessages).toEqual([
      expect.objectContaining({
        id: storedMessage.id,
        role: "assistant",
        kind: "event_card",
        content: null,
        payload,
      }),
    ]);
  });
});
