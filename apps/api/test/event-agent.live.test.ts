import { Test, type TestingModule } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { eventAgentModelProvider } from "../src/agents/event-agent/event-agent-model.provider";
import { EventAgentService } from "../src/agents/event-agent/event-agent.service";
import type { EventDraftRow, MessageRow } from "../src/database/schemas";
import { EventDraftsService } from "../src/events/event-drafts.service";
import type {
  CreatePendingEventDraftInput,
  UpdateEventDraftInput,
} from "../src/events/event-drafts.types";

const liveDescribe = process.env.EVENT_AGENT_LIVE_TEST === "1" ? describe : describe.skip;
const currentDateTime = "2026-08-27T08:00:00.000Z";
const sourceMessageId = "69b9c591-af5e-48df-9d22-bc70f91dc33a";

liveDescribe("Event Agent live-model acceptance", () => {
  let moduleRef: TestingModule | undefined;
  let service: EventAgentService;
  let sequence = 1;

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

  async function createService(): Promise<void> {
    eventDraftsService.findIncompletePendingDraftContexts.mockReset();
    eventDraftsService.createPendingDraftWithInitialCard.mockReset();
    eventDraftsService.updatePendingDraftFromAgent.mockReset();
    eventDraftsService.findIncompletePendingDraftContexts.mockResolvedValue([]);

    eventDraftsService.createPendingDraftWithInitialCard.mockImplementation(
      async ({
        sourceMessageId: messageId,
        defaultTimezone,
        event,
      }: CreatePendingEventDraftInput) => {
        const draft = makeDraft({
          sourceMessageId: messageId,
          title: event.title,
          startAt: toDatabaseDateTime(event.startAt),
          endAt: toDatabaseDateTime(event.endAt),
          timezone: event.timezone ?? defaultTimezone,
          location: event.location,
          description: event.description,
        });

        return {
          draft,
          eventCardMessage: makeEventCard(draft),
        };
      },
    );

    moduleRef = await Test.createTestingModule({
      providers: [
        eventAgentModelProvider,
        EventAgentService,
        {
          provide: EventDraftsService,
          useValue: eventDraftsService,
        },
      ],
    }).compile();

    service = moduleRef.get(EventAgentService);
  }

  it("creates a complete Event Draft", async () => {
    await createService();

    const result = await service.run(
      makeInput("Meet Anna tomorrow at 3 PM at Stockholm University."),
    );

    expect(result).toMatchObject({ kind: "event_card", clarification: null });
    expect(eventDraftsService.createPendingDraftWithInitialCard).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          title: expect.stringMatching(/meet anna/i),
          startAt: "2026-08-28T15:00:00",
        }),
      }),
    );
  });

  it("asks for a missing start time", async () => {
    await createService();

    const result = await service.run(makeInput("Meet Anna tomorrow."));

    expect(result).toMatchObject({ kind: "event_card" });
    expect(result.kind === "event_card" && result.clarification).toEqual(expect.any(String));
    expect(eventDraftsService.createPendingDraftWithInitialCard).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ startAt: null }),
      }),
    );
  });

  it("asks for a meaningful title", async () => {
    await createService();

    const result = await service.run(makeInput("I have something to do tomorrow at 3 PM."));

    expect(result).toMatchObject({ kind: "event_card" });
    expect(result.kind === "event_card" && result.clarification).toEqual(expect.any(String));
    expect(eventDraftsService.createPendingDraftWithInitialCard).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ title: null }),
      }),
    );
  });

  it("updates the Draft identified by a clarification reply", async () => {
    await createService();

    const draft = makeDraft({
      sourceMessageId: "ca176773-c72f-43d8-a193-b2a396830912",
      title: "Meet Anna",
      startAt: null,
    });
    eventDraftsService.findIncompletePendingDraftContexts.mockResolvedValue([
      { draft, sourceMessageContent: "Meet Anna tomorrow." },
    ]);
    eventDraftsService.updatePendingDraftFromAgent.mockImplementation(
      async (_draftId: string, changes: UpdateEventDraftInput) => {
        const updatedDraft = {
          ...draft,
          ...changes,
          startAt: toDatabaseDateTime(changes.startAt) ?? draft.startAt,
        } as EventDraftRow;

        return {
          kind: "updated",
          draft: updatedDraft,
          eventCardMessage: makeEventCard(updatedDraft),
        };
      },
    );

    await service.run(
      makeInput("Tomorrow at 3 PM.", [
        makeTextMessage("user", "Meet Anna tomorrow."),
        makeTextMessage("assistant", "What time should the meeting start?"),
      ]),
    );

    expect(eventDraftsService.updatePendingDraftFromAgent).toHaveBeenCalledWith(
      draft.id,
      expect.objectContaining({ startAt: "2026-08-28T15:00:00" }),
    );
    expect(eventDraftsService.createPendingDraftWithInitialCard).not.toHaveBeenCalled();
  });

  it("asks which Draft is intended when multiple candidates remain plausible", async () => {
    await createService();

    eventDraftsService.findIncompletePendingDraftContexts.mockResolvedValue([
      {
        draft: makeDraft({ title: "Meet Anna", startAt: null }),
        sourceMessageContent: "Meet Anna tomorrow.",
      },
      {
        draft: makeDraft({ title: "Dentist appointment", startAt: null }),
        sourceMessageContent: "I need a dentist appointment.",
      },
    ]);

    const result = await service.run(makeInput("Tomorrow at 3 PM."));

    expect(result).toMatchObject({ kind: "text" });
    expect(eventDraftsService.updatePendingDraftFromAgent).not.toHaveBeenCalled();
    expect(eventDraftsService.createPendingDraftWithInitialCard).not.toHaveBeenCalled();
  });

  function makeInput(content: string, history: MessageRow[] = []) {
    return {
      content,
      sourceMessageId,
      currentDateTime,
      userTimezone: "Europe/Stockholm",
      history,
    };
  }

  function makeDraft(overrides: Partial<EventDraftRow> = {}): EventDraftRow {
    return {
      id: crypto.randomUUID(),
      sourceMessageId,
      status: "pending",
      title: null,
      startAt: null,
      endAt: null,
      timezone: "Europe/Stockholm",
      location: null,
      description: null,
      createdAt: new Date(currentDateTime),
      updatedAt: new Date(currentDateTime),
      ...overrides,
    };
  }

  function makeEventCard(draft: EventDraftRow): MessageRow {
    return {
      id: crypto.randomUUID(),
      sequence: sequence++,
      role: "assistant",
      kind: "event_card",
      content: null,
      payload: {
        draftId: draft.id,
        title: draft.title,
        startAt: draft.startAt?.replace(" ", "T") ?? null,
        endAt: draft.endAt?.replace(" ", "T") ?? null,
        timezone: draft.timezone,
        location: draft.location,
        description: draft.description,
      },
      createdAt: new Date(currentDateTime),
    };
  }

  function makeTextMessage(role: "user" | "assistant", content: string): MessageRow {
    return {
      id: crypto.randomUUID(),
      sequence: sequence++,
      role,
      kind: "text",
      content,
      payload: null,
      createdAt: new Date(currentDateTime),
    };
  }

  function toDatabaseDateTime(value: string | null | undefined): string | null {
    return value?.replace("T", " ") ?? null;
  }
});
