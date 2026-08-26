import { Test, type TestingModule } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventAgentService } from "../src/agents/event-agent/event-agent.service";
import type { EventDraftRow, MessageRow } from "../src/database/schemas";
import { EventsService } from "../src/events/events.service";
import { CreateMessageDto } from "../src/messages/messages.dto";
import { MessagesRepository } from "../src/messages/messages.repository";
import { MessagesService } from "../src/messages/messages.service";

const currentDateTime = new Date("2026-08-26T08:00:00.000Z");

const userMessage: MessageRow = {
  id: "b76f993a-ef93-46d8-8654-fe393d2db4b1",
  sequence: 1,
  role: "user",
  kind: "text",
  content: "Meet Anna tomorrow at 3 PM.",
  payload: null,
  createdAt: currentDateTime,
};

const eventDraft: EventDraftRow = {
  id: "e18f2dc1-58b8-460d-aac8-7c906f5668f5",
  sourceMessageId: userMessage.id,
  status: "pending",
  title: "Meet Anna",
  startAt: "2026-08-27 15:00:00",
  endAt: null,
  timezone: "Europe/Stockholm",
  location: null,
  description: null,
  createdAt: currentDateTime,
  updatedAt: currentDateTime,
};

const eventCardMessage: MessageRow = {
  id: "a9d0377a-37dc-4e92-a980-97ae626ed385",
  sequence: 2,
  role: "assistant",
  kind: "event_card",
  content: null,
  payload: {
    draftId: eventDraft.id,
    title: eventDraft.title,
    startAt: "2026-08-27T15:00:00",
    endAt: eventDraft.endAt,
    timezone: eventDraft.timezone,
    location: eventDraft.location,
    description: eventDraft.description,
  },
  createdAt: currentDateTime,
};

const assistantTextMessage: MessageRow = {
  id: "68f08308-edc8-4b8c-aed7-cbf8342485c3",
  sequence: 2,
  role: "assistant",
  kind: "text",
  content: "I can help you create Events.",
  payload: null,
  createdAt: currentDateTime,
};

describe("CreateMessageDto", () => {
  it("accepts content with a valid IANA timezone", () => {
    expect(
      CreateMessageDto.schema.parse({
        content: "Meet Anna tomorrow at 3 PM.",
        timezone: "Europe/Stockholm",
      }),
    ).toEqual({
      content: "Meet Anna tomorrow at 3 PM.",
      timezone: "Europe/Stockholm",
    });
  });

  it("rejects an invalid timezone at the HTTP boundary", () => {
    const result = CreateMessageDto.schema.safeParse({
      content: "Meet Anna tomorrow at 3 PM.",
      timezone: "Mars/Olympus",
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["timezone"],
          }),
        ]),
      );
    }
  });
});

describe("MessagesService fixed Event workflow", () => {
  let moduleRef: TestingModule | undefined;
  let messagesService: MessagesService;

  const messagesRepository = {
    createTextMessage: vi.fn(),
  };

  const eventAgentService = {
    extractEvent: vi.fn(),
  };

  const eventsService = {
    createPendingDraftWithInitialCard: vi.fn(),
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(currentDateTime);

    messagesRepository.createTextMessage.mockReset();
    eventAgentService.extractEvent.mockReset();
    eventsService.createPendingDraftWithInitialCard.mockReset();

    moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: MessagesRepository,
          useValue: messagesRepository,
        },
        {
          provide: EventAgentService,
          useValue: eventAgentService,
        },
        {
          provide: EventsService,
          useValue: eventsService,
        },
      ],
    }).compile();

    messagesService = moduleRef.get(MessagesService);
  });

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;

    vi.useRealTimers();
  });

  it("creates an Event Draft and Event Card for an Event result", async () => {
    messagesRepository.createTextMessage.mockResolvedValue(userMessage);

    eventAgentService.extractEvent.mockResolvedValue({
      kind: "event",
      event: {
        title: "Meet Anna",
        startAt: "2026-08-27T15:00:00",
        endAt: null,
        timezone: null,
        location: null,
        description: null,
      },
    });

    eventsService.createPendingDraftWithInitialCard.mockResolvedValue({
      draft: eventDraft,
      eventCardMessage,
    });

    const result = await messagesService.createMessage({
      content: "Meet Anna tomorrow at 3 PM.",
      timezone: "Europe/Stockholm",
    });

    expect(messagesRepository.createTextMessage).toHaveBeenCalledWith({
      role: "user",
      content: "Meet Anna tomorrow at 3 PM.",
    });

    expect(eventAgentService.extractEvent).toHaveBeenCalledWith({
      content: "Meet Anna tomorrow at 3 PM.",
      currentDateTime: "2026-08-26T08:00:00.000Z",
      userTimezone: "Europe/Stockholm",
    });

    expect(eventsService.createPendingDraftWithInitialCard).toHaveBeenCalledWith({
      sourceMessageId: userMessage.id,
      defaultTimezone: "Europe/Stockholm",
      event: {
        title: "Meet Anna",
        startAt: "2026-08-27T15:00:00",
        endAt: null,
        timezone: null,
        location: null,
        description: null,
      },
    });

    expect(result).toEqual({
      userMessage,
      assistantMessage: eventCardMessage,
    });
  });

  it("persists an assistant text message for a text result", async () => {
    messagesRepository.createTextMessage
      .mockResolvedValueOnce(userMessage)
      .mockResolvedValueOnce(assistantTextMessage);

    eventAgentService.extractEvent.mockResolvedValue({
      kind: "text",
      response: "I can help you create Events.",
    });

    const result = await messagesService.createMessage({
      content: "Meet Anna tomorrow at 3 PM.",
      timezone: "Europe/Stockholm",
    });

    expect(messagesRepository.createTextMessage).toHaveBeenNthCalledWith(1, {
      role: "user",
      content: "Meet Anna tomorrow at 3 PM.",
    });

    expect(messagesRepository.createTextMessage).toHaveBeenNthCalledWith(2, {
      role: "assistant",
      content: "I can help you create Events.",
    });

    expect(eventsService.createPendingDraftWithInitialCard).not.toHaveBeenCalled();

    expect(result).toEqual({
      userMessage,
      assistantMessage: assistantTextMessage,
    });
  });

  it("keeps the user message when atomic Event intake persistence fails", async () => {
    const persistenceError = new Error("Event intake persistence failed.");

    messagesRepository.createTextMessage.mockResolvedValue(userMessage);

    eventAgentService.extractEvent.mockResolvedValue({
      kind: "event",
      event: {
        title: "Meet Anna",
        startAt: "2026-08-27T15:00:00",
        endAt: null,
        timezone: null,
        location: null,
        description: null,
      },
    });

    eventsService.createPendingDraftWithInitialCard.mockRejectedValue(persistenceError);

    await expect(
      messagesService.createMessage({
        content: "Meet Anna tomorrow at 3 PM.",
        timezone: "Europe/Stockholm",
      }),
    ).rejects.toBe(persistenceError);

    expect(messagesRepository.createTextMessage).toHaveBeenCalledOnce();
    expect(eventsService.createPendingDraftWithInitialCard).toHaveBeenCalledOnce();
  });
});
