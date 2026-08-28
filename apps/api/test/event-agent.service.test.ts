import { SystemMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EVENT_AGENT_MODEL } from "../src/agents/event-agent/event-agent-model.provider";
import { EventAgentRequestError } from "../src/agents/event-agent/event-agent.error";
import { EventAgentService } from "../src/agents/event-agent/event-agent.service";
import type { EventDraftRow, MessageRow } from "../src/database/schemas";
import { EventDraftsService } from "../src/events/event-drafts.service";

const currentDateTime = new Date("2026-08-26T08:00:00.000Z");

const sourceMessage: MessageRow = {
  id: "b76f993a-ef93-46d8-8654-fe393d2db4b1",
  sequence: 12,
  role: "user",
  kind: "text",
  content: "Tomorrow at 3 PM.",
  payload: null,
  createdAt: currentDateTime,
};

const incompleteDraft: EventDraftRow = {
  id: "e18f2dc1-58b8-460d-aac8-7c906f5668f5",
  sourceMessageId: "b433c0c2-28ac-40f4-996b-34ae1a531f57",
  status: "pending",
  title: "Meet Anna",
  startAt: null,
  endAt: null,
  timezone: "Europe/Stockholm",
  location: "Stockholm University",
  description: null,
  createdAt: currentDateTime,
  updatedAt: currentDateTime,
};

const updatedDraft: EventDraftRow = {
  ...incompleteDraft,
  startAt: "2026-08-27 15:00:00",
};

const updatedEventCardMessage: MessageRow = {
  id: "a9d0377a-37dc-4e92-a980-97ae626ed385",
  sequence: 13,
  role: "assistant",
  kind: "event_card",
  content: null,
  payload: {
    draftId: updatedDraft.id,
    title: updatedDraft.title,
    startAt: "2026-08-27T15:00:00",
    endAt: null,
    timezone: updatedDraft.timezone,
    location: updatedDraft.location,
    description: null,
  },
  createdAt: currentDateTime,
};

const history: MessageRow[] = [
  {
    id: "2a6f9658-72cd-4c5a-bd34-13dd14d44374",
    sequence: 10,
    role: "user",
    kind: "text",
    content: "Meet Anna tomorrow.",
    payload: null,
    createdAt: currentDateTime,
  },
  {
    id: "b49ea711-7d69-4832-bb81-35425a67c6e7",
    sequence: 11,
    role: "assistant",
    kind: "text",
    content: "What time should the meeting start?",
    payload: null,
    createdAt: currentDateTime,
  },
];

const runInput = {
  content: "Tomorrow at 3 PM.",
  sourceMessageId: sourceMessage.id,
  currentDateTime: currentDateTime.toISOString(),
  userTimezone: "Europe/Stockholm",
  history,
};

function finalResponse(message: string) {
  return [
    {
      name: "event_agent_response",
      args: { message },
    },
  ];
}

describe("EventAgentService bounded tool workflow", () => {
  let moduleRef: TestingModule | undefined;

  const eventDraftsService = {
    findIncompletePendingDraftContexts: vi.fn(),
    createPendingDraftWithInitialCard: vi.fn(),
    updatePendingDraftFromAgent: vi.fn(),
  };

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
    vi.restoreAllMocks();
  });

  async function createService(model: ReturnType<typeof fakeModel>): Promise<EventAgentService> {
    moduleRef = await Test.createTestingModule({
      providers: [
        EventAgentService,
        {
          provide: EVENT_AGENT_MODEL,
          useValue: model,
        },
        {
          provide: EventDraftsService,
          useValue: eventDraftsService,
        },
      ],
    }).compile();

    eventDraftsService.findIncompletePendingDraftContexts.mockReset();
    eventDraftsService.createPendingDraftWithInitialCard.mockReset();
    eventDraftsService.updatePendingDraftFromAgent.mockReset();

    return moduleRef.get(EventAgentService);
  }

  it("uses recent conversation context to update the intended incomplete Draft", async () => {
    const logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const model = fakeModel()
      .respondWithTools([{ name: "find_incomplete_event_drafts", args: {} }])
      .respondWithTools([
        {
          name: "update_event_draft",
          args: {
            draftId: incompleteDraft.id,
            changes: { startAt: "2026-08-27T15:00:00" },
          },
        },
      ])
      .respondWithTools(finalResponse("The Event Draft is ready for review."));

    const service = await createService(model);

    eventDraftsService.findIncompletePendingDraftContexts.mockResolvedValue([
      { draft: incompleteDraft, sourceMessageContent: "Meet Anna tomorrow." },
    ]);
    eventDraftsService.updatePendingDraftFromAgent.mockResolvedValue({
      kind: "updated",
      draft: updatedDraft,
      eventCardMessage: updatedEventCardMessage,
    });

    await expect(service.run(runInput)).resolves.toEqual({
      kind: "event_card",
      eventCardMessage: updatedEventCardMessage,
      clarification: null,
    });

    expect(eventDraftsService.updatePendingDraftFromAgent).toHaveBeenCalledWith(
      incompleteDraft.id,
      { startAt: "2026-08-27T15:00:00" },
    );
    expect(eventDraftsService.createPendingDraftWithInitialCard).not.toHaveBeenCalled();
    expect(model.callCount).toBe(3);

    const firstModelCall = model.calls[0];
    expect(firstModelCall?.messages.map((message) => message.content)).toEqual(
      expect.arrayContaining([
        "Meet Anna tomorrow.",
        "What time should the meeting start?",
        "Tomorrow at 3 PM.",
      ]),
    );

    const systemPrompt = firstModelCall?.messages.find(SystemMessage.isInstance);
    expect(systemPrompt).toBeDefined();
    expect(systemPrompt?.text).not.toContain(incompleteDraft.id);
    expect(systemPrompt?.text).not.toContain("Meet Anna tomorrow.");

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "event_agent.tool.started",
        sourceMessageId: sourceMessage.id,
        tool: "find_incomplete_event_drafts",
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "event_agent.tool.completed",
        sourceMessageId: sourceMessage.id,
        tool: "update_event_draft",
      }),
    );
  });

  it("does not mutate a Draft when multiple candidates remain ambiguous", async () => {
    const secondDraft = {
      ...incompleteDraft,
      id: "7ed44911-6a0a-4996-a82c-3eef21cdeeb0",
      title: "Dentist appointment",
      sourceMessageId: "9c72917a-909b-478a-9547-43c94692fa6e",
    };
    const model = fakeModel()
      .respondWithTools([{ name: "find_incomplete_event_drafts", args: {} }])
      .respondWithTools(finalResponse("Which Event should start tomorrow at 3 PM?"));
    const service = await createService(model);

    eventDraftsService.findIncompletePendingDraftContexts.mockResolvedValue([
      { draft: incompleteDraft, sourceMessageContent: "Meet Anna tomorrow." },
      { draft: secondDraft, sourceMessageContent: "I have a dentist appointment." },
    ]);

    await expect(service.run(runInput)).resolves.toEqual({
      kind: "text",
      response: "Which Event should start tomorrow at 3 PM?",
    });
    expect(eventDraftsService.updatePendingDraftFromAgent).not.toHaveBeenCalled();
    expect(eventDraftsService.createPendingDraftWithInitialCard).not.toHaveBeenCalled();
  });

  it("allows at most one Draft mutation in a run", async () => {
    const model = fakeModel()
      .respondWithTools([
        {
          name: "update_event_draft",
          args: {
            draftId: incompleteDraft.id,
            changes: { startAt: "2026-08-27T15:00:00" },
          },
        },
      ])
      .respondWithTools([
        {
          name: "create_event_draft",
          args: {
            title: "Another Event",
            startAt: "2026-08-28T10:00:00",
            endAt: null,
            timezone: null,
            location: null,
            description: null,
          },
        },
      ])
      .respondWithTools(finalResponse("The existing Event Draft was updated."));
    const service = await createService(model);

    eventDraftsService.findIncompletePendingDraftContexts.mockResolvedValue([
      { draft: incompleteDraft, sourceMessageContent: "Meet Anna tomorrow." },
    ]);
    eventDraftsService.updatePendingDraftFromAgent.mockResolvedValue({
      kind: "updated",
      draft: updatedDraft,
      eventCardMessage: updatedEventCardMessage,
    });

    await expect(service.run(runInput)).resolves.toMatchObject({
      kind: "event_card",
      eventCardMessage: updatedEventCardMessage,
    });
    expect(eventDraftsService.updatePendingDraftFromAgent).toHaveBeenCalledOnce();
    expect(eventDraftsService.createPendingDraftWithInitialCard).not.toHaveBeenCalled();
  });

  it("returns a deterministic clarification when the model fails after a successful mutation", async () => {
    const errorLogSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const providerError = new Error("Model provider unavailable after mutation");
    const model = fakeModel()
      .respondWithTools([
        {
          name: "update_event_draft",
          args: {
            draftId: incompleteDraft.id,
            changes: { location: "Main office" },
          },
        },
      ])
      .respond(providerError);
    const service = await createService(model);
    const eventCardMessage = {
      ...updatedEventCardMessage,
      payload: {
        ...updatedEventCardMessage.payload,
        startAt: null,
        location: "Main office",
      },
    };

    eventDraftsService.findIncompletePendingDraftContexts.mockResolvedValue([
      { draft: incompleteDraft, sourceMessageContent: "Meet Anna tomorrow." },
    ]);
    eventDraftsService.updatePendingDraftFromAgent.mockResolvedValue({
      kind: "updated",
      draft: {
        ...incompleteDraft,
        location: "Main office",
      },
      eventCardMessage,
    });

    await expect(service.run(runInput)).resolves.toEqual({
      kind: "event_card",
      eventCardMessage,
      clarification: "What time should this Event start?",
    });
    expect(errorLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "event_agent.post_mutation_fallback",
        sourceMessageId: sourceMessage.id,
        draftId: incompleteDraft.id,
      }),
    );
  });

  it("does not classify a tool persistence failure as provider unavailability", async () => {
    const persistenceError = new Error("Event Draft persistence failed");
    const model = fakeModel().respondWithTools([
      {
        name: "create_event_draft",
        args: {
          title: "Meet Anna",
          startAt: "2026-08-27T15:00:00",
          endAt: null,
          timezone: null,
          location: null,
          description: null,
        },
      },
    ]);
    const service = await createService(model);

    eventDraftsService.findIncompletePendingDraftContexts.mockResolvedValue([]);
    eventDraftsService.createPendingDraftWithInitialCard.mockRejectedValue(persistenceError);

    await expect(service.run(runInput)).rejects.toBe(persistenceError);
  });

  it("maps model invocation failures and preserves the original cause", async () => {
    const providerError = new Error("Model provider unavailable");
    const model = fakeModel().alwaysThrow(providerError);
    const service = await createService(model);

    eventDraftsService.findIncompletePendingDraftContexts.mockResolvedValue([]);

    const actualError = await service.run(runInput).catch((error: unknown) => error);

    expect(actualError).toBeInstanceOf(EventAgentRequestError);
    expect((actualError as EventAgentRequestError).cause).toBe(providerError);
    expect((actualError as EventAgentRequestError).publicMessage).toBe(
      "The Event assistant could not process your message. Please try again.",
    );
  });
});
