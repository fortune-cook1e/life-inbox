import { Test, type TestingModule } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventAgentService } from "../src/agents/event-agent/event-agent.service";
import type { EventDraftRow, MessageRow } from "../src/database/schemas";
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

const clarificationMessage: MessageRow = {
  ...assistantTextMessage,
  id: "b49ea711-7d69-4832-bb81-35425a67c6e7",
  sequence: 3,
  content: "What time should this Event start?",
};

const incompleteUserMessage: MessageRow = {
  ...userMessage,
  id: "96b24938-1ee3-43b2-85cf-b505a0f7e68d",
  content: "Meet Anna tomorrow.",
};

describe("MessagesService Event Agent workflow", () => {
  let moduleRef: TestingModule | undefined;
  let messagesService: MessagesService;

  const messagesRepository = {
    createTextMessage: vi.fn(),
    findRecentBeforeSequence: vi.fn(),
  };

  const eventAgentService = {
    run: vi.fn(),
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(currentDateTime);

    messagesRepository.createTextMessage.mockReset();
    messagesRepository.findRecentBeforeSequence.mockReset();
    eventAgentService.run.mockReset();

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

    messagesRepository.findRecentBeforeSequence.mockResolvedValue([]);
    eventAgentService.run.mockResolvedValue({
      kind: "event_card",
      eventCardMessage,
      clarification: null,
    });

    const result = await messagesService.createMessage({
      content: "Meet Anna tomorrow at 3 PM.",
      timezone: "Europe/Stockholm",
    });

    expect(messagesRepository.createTextMessage).toHaveBeenCalledWith({
      role: "user",
      content: "Meet Anna tomorrow at 3 PM.",
    });

    expect(messagesRepository.findRecentBeforeSequence).toHaveBeenCalledWith(
      userMessage.sequence,
      10,
    );

    expect(eventAgentService.run).toHaveBeenCalledWith({
      content: "Meet Anna tomorrow at 3 PM.",
      sourceMessageId: userMessage.id,
      currentDateTime: "2026-08-26T08:00:00.000Z",
      userTimezone: "Europe/Stockholm",
      history: [],
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

    messagesRepository.findRecentBeforeSequence.mockResolvedValue([]);
    eventAgentService.run.mockResolvedValue({
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

    expect(result).toEqual({
      userMessage,
      assistantMessage: assistantTextMessage,
    });
  });

  it("persists the Agent clarification after an incomplete Event Card", async () => {
    messagesRepository.createTextMessage
      .mockResolvedValueOnce(incompleteUserMessage)
      .mockResolvedValueOnce(clarificationMessage);
    messagesRepository.findRecentBeforeSequence.mockResolvedValue([]);
    eventAgentService.run.mockResolvedValue({
      kind: "event_card",
      eventCardMessage,
      clarification: "What time should this Event start?",
    });

    const result = await messagesService.createMessage({
      content: "Meet Anna tomorrow.",
      timezone: "Europe/Stockholm",
    });

    expect(messagesRepository.createTextMessage).toHaveBeenNthCalledWith(2, {
      role: "assistant",
      content: "What time should this Event start?",
    });
    expect(result).toEqual({
      userMessage: incompleteUserMessage,
      assistantMessage: clarificationMessage,
    });
  });

  it("keeps the user message when atomic Event intake persistence fails", async () => {
    const persistenceError = new Error("Event intake persistence failed.");

    messagesRepository.createTextMessage.mockResolvedValue(userMessage);

    messagesRepository.findRecentBeforeSequence.mockResolvedValue([]);
    eventAgentService.run.mockRejectedValue(persistenceError);

    await expect(
      messagesService.createMessage({
        content: "Meet Anna tomorrow at 3 PM.",
        timezone: "Europe/Stockholm",
      }),
    ).rejects.toBe(persistenceError);

    expect(messagesRepository.createTextMessage).toHaveBeenCalledOnce();
    expect(eventAgentService.run).toHaveBeenCalledOnce();
  });
});
