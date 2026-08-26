import { fakeModel } from "@langchain/core/testing";
import {
  API_SUCCESS_CODE,
  ApiErrorCode,
  type ApiErrorEnvelope,
  type ApiSuccessEnvelope,
} from "@life-inbox/shared";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { EVENT_AGENT_MODEL } from "../src/agents/event-agent/event-agent-model.provider";
import { AppModule } from "../src/app.module";
import { DatabaseService } from "../src/database/database.service";
import { eventDrafts, messages } from "../src/database/schemas";

const cancellationContent = "Event creation was cancelled.";

interface EventDraftSnapshot {
  draftId: string;
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  timezone: string;
  location: string | null;
  description: string | null;
}

interface EventEditResponse {
  id: string;
  role: "user";
  kind: "event_edit";
  payload: EventDraftSnapshot;
  createdAt: string;
}

interface EventConfirmResponse {
  id: string;
  role: "user";
  kind: "event_confirm";
  payload: {
    draftId: string;
    eventId: string;
  };
  createdAt: string;
}

interface EventRejectResponse {
  id: string;
  role: "user";
  kind: "event_reject";
  payload: {
    draftId: string;
  };
  createdAt: string;
}

interface CancellationResponse {
  id: string;
  role: "assistant";
  kind: "text";
  content: string;
  createdAt: string;
}

type RejectDraftResponse = [
  eventReject: EventRejectResponse,
  cancellation: CancellationResponse,
];

type TimelineResponse = Array<
  | EventRejectResponse
  | CancellationResponse
  | {
      id: string;
      role: string;
      kind: string;
      content?: string;
      payload?: unknown;
      createdAt: string;
    }
>;

interface StoredEvent extends Record<string, unknown> {
  id: string;
  sourceDraftId: string;
  title: string;
  startAt: string;
  endAt: string | null;
  timezone: string;
  location: string | null;
  description: string | null;
}

describe("Event Draft lifecycle HTTP workflow", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let database: DatabaseService;

  let draftId: string | undefined;
  let confirmedEventId: string | undefined;

  const createdTimelineMessageIds: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EVENT_AGENT_MODEL)
      .useValue(fakeModel())
      .compile();

    database = moduleRef.get(DatabaseService);

    app = moduleRef.createNestApplication({
      logger: false,
    });

    app.setGlobalPrefix("api");

    await app.listen(0, "127.0.0.1");
  });

  beforeEach(async () => {
    const [sourceMessage] = await database.db
      .insert(messages)
      .values({
        role: "user",
        kind: "text",
        content: "Meet Anna tomorrow at 3 PM.",
        payload: null,
      })
      .returning({
        id: messages.id,
      });

    if (sourceMessage === undefined) {
      throw new Error("Source Message insert returned no row.");
    }

    createdTimelineMessageIds.push(sourceMessage.id);

    const [draft] = await database.db
      .insert(eventDrafts)
      .values({
        sourceMessageId: sourceMessage.id,
        status: "pending",
        title: "Meet Anna",
        startAt: "2026-08-27T15:00:00",
        endAt: null,
        timezone: "Europe/Stockholm",
        location: "Stockholm University",
        description: null,
      })
      .returning({
        id: eventDrafts.id,
      });

    if (draft === undefined) {
      throw new Error("Event Draft insert returned no row.");
    }

    draftId = draft.id;
  });

  afterEach(async () => {
    if (confirmedEventId !== undefined) {
      await database.db.execute(sql`
        DELETE FROM events
        WHERE id = ${confirmedEventId}::uuid
      `);
    }

    if (draftId !== undefined) {
      await database.db.delete(eventDrafts).where(eq(eventDrafts.id, draftId));
    }

    if (createdTimelineMessageIds.length > 0) {
      await database.db.delete(messages).where(inArray(messages.id, createdTimelineMessageIds));
    }

    draftId = undefined;
    confirmedEventId = undefined;
    createdTimelineMessageIds.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  function getDraftId(): string {
    if (draftId === undefined) {
      throw new Error("Event Draft test fixture was not initialized.");
    }

    return draftId;
  }

  async function countTimelineKind(kind: "event_edit" | "event_confirm"): Promise<number> {
    const [result] = await database.db
      .select({
        value: count(),
      })
      .from(messages)
      .where(and(eq(messages.kind, kind), eq(messages.role, "user")));

    return result?.value ?? 0;
  }

  async function rejectDraft(): Promise<Response> {
    return fetch(`${await app.getUrl()}/api/event-drafts/${getDraftId()}/reject`, {
      method: "POST",
    });
  }

  async function countCancellationMessages(): Promise<number> {
    const [result] = await database.db
      .select({
        value: count(),
      })
      .from(messages)
      .where(
        and(
          eq(messages.role, "assistant"),
          eq(messages.kind, "text"),
          eq(messages.content, cancellationContent),
        ),
      );

    return result?.value ?? 0;
  }

  it("edits a pending Draft and persists its updated snapshot", async () => {
    const response = await fetch(`${await app.getUrl()}/api/event-drafts/${getDraftId()}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        startAt: "2026-08-27T16:00:00",
        endAt: "2026-08-27T17:00:00",
        location: "Kista",
        description: "Bring the project plan.",
      }),
    });

    expect(response.status).toBe(200);

    const envelope = (await response.json()) as ApiSuccessEnvelope<EventEditResponse>;

    expect(envelope.code).toBe(API_SUCCESS_CODE);

    const interaction = envelope.data;
    createdTimelineMessageIds.push(interaction.id);

    expect(interaction).toMatchObject({
      role: "user",
      kind: "event_edit",
      payload: {
        draftId: getDraftId(),
        title: "Meet Anna",
        startAt: "2026-08-27T16:00:00",
        endAt: "2026-08-27T17:00:00",
        timezone: "Europe/Stockholm",
        location: "Kista",
        description: "Bring the project plan.",
      },
    });

    const persistedDraft = await database.db.query.eventDrafts.findFirst({
      where: eq(eventDrafts.id, getDraftId()),
    });

    expect(persistedDraft).toMatchObject({
      status: "pending",
      startAt: "2026-08-27 16:00:00",
      endAt: "2026-08-27 17:00:00",
      location: "Kista",
      description: "Bring the project plan.",
    });

    const historyResponse = await fetch(`${await app.getUrl()}/api/messages`);
    const historyEnvelope = (await historyResponse.json()) as ApiSuccessEnvelope<
      Array<EventEditResponse | Record<string, unknown>>
    >;

    expect(historyEnvelope.data).toContainEqual(interaction);
  });

  it("does not edit a Draft after it leaves pending status", async () => {
    await database.db
      .update(eventDrafts)
      .set({
        status: "rejected",
      })
      .where(eq(eventDrafts.id, getDraftId()));

    const editCountBefore = await countTimelineKind("event_edit");

    const response = await fetch(`${await app.getUrl()}/api/event-drafts/${getDraftId()}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Changed after rejection",
      }),
    });

    expect(response.status).toBe(409);

    const envelope = (await response.json()) as ApiErrorEnvelope;

    expect(envelope.code).toBe(ApiErrorCode.Conflict);
    expect(await countTimelineKind("event_edit")).toBe(editCountBefore);

    const persistedDraft = await database.db.query.eventDrafts.findFirst({
      where: eq(eventDrafts.id, getDraftId()),
    });

    expect(persistedDraft).toMatchObject({
      status: "rejected",
      title: "Meet Anna",
    });
  });

  it("confirms one complete Draft into one final Event exactly once", async () => {
    const confirmCountBefore = await countTimelineKind("event_confirm");

    const firstResponse = await fetch(
      `${await app.getUrl()}/api/event-drafts/${getDraftId()}/confirm`,
      {
        method: "POST",
      },
    );

    expect(firstResponse.status).toBe(200);

    const firstEnvelope = (await firstResponse.json()) as ApiSuccessEnvelope<EventConfirmResponse>;
    const interaction = firstEnvelope.data;

    createdTimelineMessageIds.push(interaction.id);
    confirmedEventId = interaction.payload.eventId;

    expect(interaction).toMatchObject({
      role: "user",
      kind: "event_confirm",
      payload: {
        draftId: getDraftId(),
        eventId: expect.any(String),
      },
    });

    const eventResult = await database.db.execute<StoredEvent>(sql`
      SELECT
        id,
        source_draft_id AS "sourceDraftId",
        title,
        start_at AS "startAt",
        end_at AS "endAt",
        timezone,
        location,
        description
      FROM events
      WHERE id = ${confirmedEventId}::uuid
    `);

    expect(eventResult.rows).toEqual([
      {
        id: confirmedEventId,
        sourceDraftId: getDraftId(),
        title: "Meet Anna",
        startAt: "2026-08-27 15:00:00",
        endAt: null,
        timezone: "Europe/Stockholm",
        location: "Stockholm University",
        description: null,
      },
    ]);

    const persistedDraft = await database.db.query.eventDrafts.findFirst({
      where: eq(eventDrafts.id, getDraftId()),
    });

    expect(persistedDraft?.status).toBe("confirmed");

    const secondResponse = await fetch(
      `${await app.getUrl()}/api/event-drafts/${getDraftId()}/confirm`,
      {
        method: "POST",
      },
    );

    expect(secondResponse.status).toBe(409);
    expect(await countTimelineKind("event_confirm")).toBe(confirmCountBefore + 1);

    const duplicateCount = await database.db.execute<{ value: number }>(sql`
      SELECT count(*)::int AS value
      FROM events
      WHERE source_draft_id = ${getDraftId()}::uuid
    `);

    expect(duplicateCount.rows[0]?.value).toBe(1);
  });

  it("keeps an incomplete Draft pending and creates no Event", async () => {
    await database.db
      .update(eventDrafts)
      .set({
        title: null,
        startAt: null,
      })
      .where(eq(eventDrafts.id, getDraftId()));

    const confirmCountBefore = await countTimelineKind("event_confirm");

    const response = await fetch(`${await app.getUrl()}/api/event-drafts/${getDraftId()}/confirm`, {
      method: "POST",
    });

    expect(response.status).toBe(422);

    const envelope = (await response.json()) as ApiErrorEnvelope;

    expect(envelope).toEqual({
      code: ApiErrorCode.ValidationError,
      data: null,
      message: "Request validation failed.",
    });

    const persistedDraft = await database.db.query.eventDrafts.findFirst({
      where: eq(eventDrafts.id, getDraftId()),
    });

    expect(persistedDraft?.status).toBe("pending");
    expect(await countTimelineKind("event_confirm")).toBe(confirmCountBefore);
  });

  it("rejects a pending Draft and persists both timeline interactions", async () => {
    const response = await rejectDraft();

    expect(response.status).toBe(200);

    const envelope = (await response.json()) as ApiSuccessEnvelope<RejectDraftResponse>;

    expect(envelope.code).toBe(API_SUCCESS_CODE);

    const interactions = envelope.data;
    const [eventReject, cancellation] = interactions;

    createdTimelineMessageIds.push(eventReject.id, cancellation.id);

    expect(eventReject).toMatchObject({
      role: "user",
      kind: "event_reject",
      payload: {
        draftId: getDraftId(),
      },
    });

    expect(cancellation).toMatchObject({
      role: "assistant",
      kind: "text",
      content: cancellationContent,
    });

    const persistedDraft = await database.db.query.eventDrafts.findFirst({
      where: eq(eventDrafts.id, getDraftId()),
    });

    expect(persistedDraft?.status).toBe("rejected");

    const historyResponse = await fetch(`${await app.getUrl()}/api/messages`);

    expect(historyResponse.status).toBe(200);

    const historyEnvelope = (await historyResponse.json()) as ApiSuccessEnvelope<TimelineResponse>;
    const history = historyEnvelope.data;

    const rejectionIndex = history.findIndex((interaction) => interaction.id === eventReject.id);
    const cancellationIndex = history.findIndex(
      (interaction) => interaction.id === cancellation.id,
    );

    expect(rejectionIndex).toBeGreaterThanOrEqual(0);
    expect(cancellationIndex).toBe(rejectionIndex + 1);
    expect(history.slice(rejectionIndex, cancellationIndex + 1)).toEqual(interactions);
  });

  it("rejects a repeated transition without duplicating interactions", async () => {
    const cancellationCountBefore = await countCancellationMessages();

    const firstResponse = await rejectDraft();

    expect(firstResponse.status).toBe(200);

    const firstEnvelope = (await firstResponse.json()) as ApiSuccessEnvelope<RejectDraftResponse>;
    const firstInteractions = firstEnvelope.data;

    createdTimelineMessageIds.push(firstInteractions[0].id, firstInteractions[1].id);

    const secondResponse = await rejectDraft();

    expect(secondResponse.status).toBe(409);

    const errorEnvelope = (await secondResponse.json()) as ApiErrorEnvelope;

    expect(errorEnvelope).toEqual({
      code: ApiErrorCode.Conflict,
      data: null,
      message: "The request conflicts with the current resource state.",
    });

    expect(await countCancellationMessages()).toBe(cancellationCountBefore + 1);

    const historyResponse = await fetch(`${await app.getUrl()}/api/messages`);
    const historyEnvelope = (await historyResponse.json()) as ApiSuccessEnvelope<TimelineResponse>;

    const rejectionInteractions = historyEnvelope.data.filter(
      (interaction) =>
        interaction.kind === "event_reject" &&
        "payload" in interaction &&
        typeof interaction.payload === "object" &&
        interaction.payload !== null &&
        "draftId" in interaction.payload &&
        interaction.payload.draftId === getDraftId(),
    );

    expect(rejectionInteractions).toHaveLength(1);
  });
});
