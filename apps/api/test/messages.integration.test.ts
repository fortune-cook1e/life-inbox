import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import process from "node:process";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { MockLanguageModelV4 } from "ai/test";
import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { AGENT_LANGUAGE_MODEL } from "../src/agent/agent.constants.js";
import type { AgentLanguageModelFactory } from "../src/agent/agent-model.provider.js";

let app: INestApplication;
let baseUrl: string;
let databaseClient: Client;
let toolCallSequence: string[] = [];
let modelPrompts: string[] = [];
let toolCallId = 0;
const agentModel = new MockLanguageModelV4({
  doGenerate: async (options) => {
    const prompt = JSON.stringify(options.prompt);
    modelPrompts.push(prompt);
    const isDentist = prompt.includes("Remind me to visit the dentist next Friday.");
    const isCompleteDentist = prompt.includes(
      "Remind me to visit the dentist next Friday at 10 AM.",
    );
    const shouldFail = prompt.includes("Agent provider should fail.");
    const shouldStayInvalid = prompt.includes("Agent keeps proposing invalid data.");
    const shouldPreviewTooEarly = prompt.includes("Agent previews too early.");
    const shouldRepeatCase = prompt.includes("Agent repeats case creation.");
    const shouldRepeatEvent = prompt.includes("Agent repeats event proposal.");
    const createdCaseCount = countOccurrences(prompt, '"toolName":"create_case"');
    const proposedEventCount = countOccurrences(prompt, '"toolName":"propose_calendar_event"');
    const hasCreatedCase = createdCaseCount > 0;
    const hasProposedEvent = proposedEventCount > 0;
    const hasShownPreview = prompt.includes('"toolName":"show_event_preview"');

    if (!hasCreatedCase) {
      return toolCall("create_case", {});
    }

    if (shouldRepeatCase && createdCaseCount === 2) {
      return toolCall("create_case", {});
    }

    if (shouldFail && !hasProposedEvent) {
      throw new Error("OpenAI is unavailable");
    }

    if (shouldPreviewTooEarly && !hasShownPreview) {
      return toolCall("show_event_preview", {
        message: "This should be rejected.",
      });
    }

    if (!hasProposedEvent || shouldStayInvalid) {
      return toolCall("propose_calendar_event", {
        title: shouldStayInvalid
          ? "Invalid event"
          : isDentist || isCompleteDentist
            ? "Visit the dentist"
            : "Book the laundry room",
        startAt:
          isDentist || shouldPreviewTooEarly
            ? null
            : isCompleteDentist
              ? "2026-08-07T10:00:00+02:00"
              : "2026-08-04T08:00:00.000Z",
        endAt: shouldStayInvalid ? "2026-08-04T07:00:00.000Z" : null,
        timeZone: null,
        location: isDentist || isCompleteDentist ? null : "Laundry room",
      });
    }

    if (shouldRepeatEvent && proposedEventCount === 2) {
      return toolCall("propose_calendar_event", {
        title: "Book the laundry room",
        startAt: "2026-08-04T08:00:00.000Z",
        endAt: null,
        timeZone: null,
        location: "Laundry room",
      });
    }

    if (isDentist || shouldPreviewTooEarly) {
      return toolCall("ask_user", {
        field: "startAt",
        question: "What time should I use next Friday?",
      });
    }

    return toolCall("show_event_preview", {
      message: "I found this event. Please review it.",
    });
  },
});

beforeAll(async () => {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AGENT_LANGUAGE_MODEL)
    .useValue((() => ({ model: agentModel })) satisfies AgentLanguageModelFactory)
    .compile();

  app = module.createNestApplication({ logger: false });
  await app.listen(0, "127.0.0.1");

  const address = app.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  databaseClient = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await databaseClient.connect();
});

afterAll(async () => {
  await databaseClient.end();
  await app.close();
});

it("POST /messages creates one Message, Case, Event, and preview", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;
  const content = "Remind me to book the laundry room next Tuesday.";

  try {
    const before = await countRows(databaseClient);
    const response = await postMessage({
      clientMessageId,
      content,
    });
    const body = (await response.json()) as MessageResponse;

    expect(response.status).toBe(201);
    expect(body).toEqual({
      message: {
        id: expect.any(String),
        role: "USER",
        kind: "USER_TEXT",
        content,
        createdAt: expect.any(String),
      },
      assistantMessage: {
        id: expect.any(String),
        role: "ASSISTANT",
        kind: "EVENT_PREVIEW",
        content: "I found this event. Please review it.",
        createdAt: expect.any(String),
      },
      event: {
        id: expect.any(String),
        status: "READY",
        title: "Book the laundry room",
        startAt: "2026-08-04T08:00:00.000Z",
        endAt: null,
        timeZone: "Europe/Stockholm",
        location: "Laundry room",
        version: 1,
      },
    });
    expect(body).not.toHaveProperty("lifeCase");
    expect(body.message).not.toHaveProperty("caseId");
    expect(body.message).not.toHaveProperty("clientMessageId");

    const after = await countRows(databaseClient);

    expect(after.lifeCases).toBe(before.lifeCases + 1);
    expect(after.chatMessages).toBe(before.chatMessages + 2);
    expect(after.events).toBe(before.events + 1);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it.each([
  {
    content: "Agent repeats case creation.",
    expectedTools: ["create_case", "create_case", "propose_calendar_event", "show_event_preview"],
  },
  {
    content: "Agent repeats event proposal.",
    expectedTools: [
      "create_case",
      "propose_calendar_event",
      "propose_calendar_event",
      "show_event_preview",
    ],
  },
])(
  "POST /messages tolerates repeated Agent tool calls for $content",
  async ({ content, expectedTools }) => {
    const clientMessageId = `message-test-${randomUUID()}`;

    try {
      toolCallSequence = [];
      const before = await countRows(databaseClient);
      const response = await postMessage({ clientMessageId, content });
      const body = (await response.json()) as MessageResponse;

      expect(response.status).toBe(201);
      expect(body.assistantMessage.kind).toBe("EVENT_PREVIEW");
      expect(toolCallSequence).toEqual(expectedTools);

      const after = await countRows(databaseClient);

      expect(after.lifeCases).toBe(before.lifeCases + 1);
      expect(after.chatMessages).toBe(before.chatMessages + 2);
      expect(after.events).toBe(before.events + 1);
    } finally {
      await cleanupMatter(databaseClient, clientMessageId);
    }
  },
);

it("POST /messages derives a title from a clear user action", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;
  const content = "Remind me to visit the dentist next Friday at 10 AM.";

  try {
    toolCallSequence = [];
    modelPrompts = [];
    const response = await postMessage({
      clientMessageId,
      content,
    });
    const body = (await response.json()) as MessageResponse;

    expect(response.status).toBe(201);
    expect(body.assistantMessage).toMatchObject({
      kind: "EVENT_PREVIEW",
    });
    expect(body.event).toMatchObject({
      status: "READY",
      title: "Visit the dentist",
      startAt: "2026-08-07T08:00:00.000Z",
      endAt: null,
      timeZone: "Europe/Stockholm",
      location: null,
    });
    expect(toolCallSequence).toEqual([
      "create_case",
      "propose_calendar_event",
      "show_event_preview",
    ]);
    expect(
      modelPrompts.some((prompt) =>
        prompt.includes(
          "You are responsible for resolving relative dates and converting natural-language dates and times",
        ),
      ),
    ).toBe(true);
    expect(
      modelPrompts.some((prompt) =>
        prompt.includes(
          "Never ask the user to provide ISO 8601, UTC, an offset, or another technical time representation",
        ),
      ),
    ).toBe(true);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it("POST /messages creates a collecting Event and asks one clarification question", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;
  const content = "Remind me to visit the dentist next Friday.";

  try {
    toolCallSequence = [];
    const before = await countRows(databaseClient);
    const response = await postMessage({
      clientMessageId,
      content,
    });
    const body = (await response.json()) as MessageResponse;

    expect(response.status).toBe(201);
    expect(body.assistantMessage).toMatchObject({
      role: "ASSISTANT",
      kind: "CLARIFICATION_QUESTION",
      content: "What time should I use next Friday?",
    });
    expect(body.event).toEqual({
      id: expect.any(String),
      status: "COLLECTING",
      title: "Visit the dentist",
      startAt: null,
      endAt: null,
      timeZone: "Europe/Stockholm",
      location: null,
      version: 1,
    });

    const after = await countRows(databaseClient);

    expect(after.lifeCases).toBe(before.lifeCases + 1);
    expect(after.chatMessages).toBe(before.chatMessages + 2);
    expect(after.events).toBe(before.events + 1);
    expect(toolCallSequence).toEqual(["create_case", "propose_calendar_event", "ask_user"]);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it("POST /messages lets the Agent recover when preview is rejected by backend validation", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;

  try {
    toolCallSequence = [];
    const response = await postMessage({
      clientMessageId,
      content: "Agent previews too early.",
    });
    const body = (await response.json()) as MessageResponse;

    expect(response.status).toBe(201);
    expect(body.event.status).toBe("COLLECTING");
    expect(body.assistantMessage.kind).toBe("CLARIFICATION_QUESTION");
    expect(toolCallSequence).toEqual([
      "create_case",
      "show_event_preview",
      "propose_calendar_event",
      "ask_user",
    ]);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it("POST /messages prefers the caller's IANA time zone", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;

  try {
    const response = await postMessage({
      clientMessageId,
      content: "Remind me to book the laundry room next Tuesday.",
      timeZone: "Asia/Shanghai",
    });
    const body = (await response.json()) as MessageResponse;

    expect(response.status).toBe(201);
    expect(body.event.timeZone).toBe("Asia/Shanghai");
    expect(body.assistantMessage.content).toBe("I found this event. Please review it.");
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it("POST /messages preserves the user evidence when the Agent provider fails", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;

  try {
    const before = await countRows(databaseClient);
    const response = await postMessage({
      clientMessageId,
      content: "Agent provider should fail.",
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "AGENT_UNAVAILABLE",
      message: "Your message was saved, but the Agent could not finish processing it.",
    });

    const after = await countRows(databaseClient);

    expect(after.lifeCases).toBe(before.lifeCases + 1);
    expect(after.chatMessages).toBe(before.chatMessages + 1);
    expect(after.events).toBe(before.events);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it("POST /messages stops after four steps when the Agent keeps proposing invalid data", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;

  try {
    const before = await countRows(databaseClient);
    const response = await postMessage({
      clientMessageId,
      content: "Agent keeps proposing invalid data.",
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "AGENT_STEP_LIMIT_REACHED",
    });

    const after = await countRows(databaseClient);

    expect(after.lifeCases).toBe(before.lifeCases + 1);
    expect(after.chatMessages).toBe(before.chatMessages + 1);
    expect(after.events).toBe(before.events);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it.each([
  {
    name: "blank content",
    body: {
      clientMessageId: `message-test-${randomUUID()}`,
      content: "   ",
    },
  },
  {
    name: "the legacy intent property",
    body: {
      intent: "NEW_MATTER",
      clientMessageId: `message-test-${randomUUID()}`,
      content: "Hello.",
    },
  },
  {
    name: "an unknown property",
    body: {
      clientMessageId: `message-test-${randomUUID()}`,
      content: "Remind me to do laundry.",
      caseId: randomUUID(),
    },
  },
  {
    name: "an invalid time zone",
    body: {
      clientMessageId: `message-test-${randomUUID()}`,
      content: "Remind me to do laundry.",
      timeZone: "EU",
    },
  },
])("POST /messages rejects $name", async ({ body }) => {
  const before = await countRows(databaseClient);
  const response = await postMessage(body);

  expect(response.status).toBe(400);
  expect(await countRows(databaseClient)).toEqual(before);
});

it("GET /messages returns the latest page in stable chronological order", async () => {
  const messageIds = [
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
    "00000000-0000-0000-0000-000000000003",
  ] satisfies [string, string, string];

  try {
    await databaseClient.query(
      `
        insert into chat_messages (
          id,
          role,
          kind,
          content,
          created_at
        )
        values
          ($1, 'SYSTEM', 'STATUS', 'First tied message',  '2099-01-01T10:00:00.000Z'),
          ($2, 'SYSTEM', 'STATUS', 'Second tied message', '2099-01-01T10:00:00.000Z'),
          ($3, 'SYSTEM', 'STATUS', 'Latest message',       '2099-01-01T10:01:00.000Z')
      `,
      messageIds,
    );

    const latestPageResponse = await fetch(`${baseUrl}/messages?limit=2`);
    const latestPage = (await latestPageResponse.json()) as MessagesPageResponse;

    expect(latestPageResponse.status).toBe(200);
    expect(latestPage.items.map((message) => message.id)).toEqual([messageIds[1], messageIds[2]]);
    expect(latestPage.pageInfo).toEqual({
      hasMore: true,
      nextCursor: expect.any(String),
    });

    const olderPageResponse = await fetch(
      `${baseUrl}/messages?limit=2&cursor=${encodeURIComponent(latestPage.pageInfo.nextCursor!)}`,
    );
    const olderPage = (await olderPageResponse.json()) as MessagesPageResponse;

    expect(olderPageResponse.status).toBe(200);
    expect(
      olderPage.items.map((message) => message.id).filter((id) => messageIds.includes(id)),
    ).toEqual([messageIds[0]]);
    expect(olderPage.items.map((message) => message.id)).not.toContain(messageIds[1]);
    expect(olderPage.items.map((message) => message.id)).not.toContain(messageIds[2]);

    const completePageResponse = await fetch(`${baseUrl}/messages?limit=3`);
    const completePage = (await completePageResponse.json()) as MessagesPageResponse;

    expect(completePageResponse.status).toBe(200);
    expect(completePage.items.map((message) => message.id)).toEqual(messageIds);

    for (const message of completePage.items) {
      expect(message).not.toHaveProperty("caseId");
      expect(message).not.toHaveProperty("clientMessageId");
    }

    const oldestResult = await databaseClient.query<{ created_at: Date }>(
      "select min(created_at) as created_at from chat_messages",
    );
    const oldestCreatedAt = oldestResult.rows[0]?.created_at;

    expect(oldestCreatedAt).toBeInstanceOf(Date);

    const exhaustedCursor = Buffer.from(
      JSON.stringify({
        id: "00000000-0000-0000-0000-000000000000",
        createdAt: new Date(oldestCreatedAt!.getTime() - 1).toISOString(),
      }),
    ).toString("base64url");
    const exhaustedPageResponse = await fetch(
      `${baseUrl}/messages?cursor=${encodeURIComponent(exhaustedCursor)}`,
    );
    const exhaustedPage = (await exhaustedPageResponse.json()) as MessagesPageResponse;

    expect(exhaustedPageResponse.status).toBe(200);
    expect(exhaustedPage).toEqual({
      items: [],
      pageInfo: {
        hasMore: false,
        nextCursor: null,
      },
    });
  } finally {
    await databaseClient.query(
      `
        delete from chat_messages
        where id = any($1::uuid[])
      `,
      [messageIds],
    );
  }
});

it.each(["0", "101", "not-a-number"])("GET /messages rejects limit=%s", async (limit) => {
  const response = await fetch(`${baseUrl}/messages?limit=${limit}`);

  expect(response.status).toBe(400);
});

it("GET /messages rejects an invalid cursor", async () => {
  const response = await fetch(`${baseUrl}/messages?cursor=not-a-valid-cursor`);

  expect(response.status).toBe(400);
});

function postMessage(body: object) {
  return fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

type MockGenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;

function toolCall(toolName: string, input: object): MockGenerateResult {
  toolCallSequence.push(toolName);
  toolCallId += 1;

  return {
    content: [
      {
        type: "tool-call",
        toolCallId: `tool-call-${toolCallId}`,
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: {
      unified: "tool-calls",
      raw: undefined,
    },
    usage: {
      inputTokens: {
        total: 10,
        noCache: 10,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 10,
        text: 10,
        reasoning: undefined,
      },
    },
    warnings: [],
  };
}

function countOccurrences(value: string, search: string) {
  return value.split(search).length - 1;
}

async function cleanupMatter(client: Client, clientMessageId: string) {
  const result = await client.query(
    `
      select case_id
      from chat_messages
      where client_message_id = $1
    `,
    [clientMessageId],
  );

  const caseIds = result.rows.map((row) => row.case_id).filter((caseId) => caseId !== null);

  if (caseIds.length > 0) {
    await client.query(
      `
        delete from chat_messages
        where case_id = any($1::uuid[])
      `,
      [caseIds],
    );
    await client.query(
      `
        delete from events
        where case_id = any($1::uuid[])
      `,
      [caseIds],
    );
    await client.query(
      `
        delete from life_cases
        where id = any($1::uuid[])
      `,
      [caseIds],
    );
  }

  await client.query(
    `
      delete from chat_messages
      where client_message_id = $1
    `,
    [clientMessageId],
  );
}

async function countRows(client: Client) {
  const result = await client.query(`
    select
      (select count(*)::integer from life_cases) as life_cases,
      (select count(*)::integer from chat_messages) as chat_messages,
      (select count(*)::integer from events) as events
  `);

  return {
    lifeCases: result.rows[0].life_cases as number,
    chatMessages: result.rows[0].chat_messages as number,
    events: result.rows[0].events as number,
  };
}

interface MessageResponse {
  message: {
    id: string;
    role: "USER";
    kind: "USER_TEXT";
    content: string;
    createdAt: string;
  };
  assistantMessage: {
    id: string;
    role: "ASSISTANT";
    kind: "CLARIFICATION_QUESTION" | "EVENT_PREVIEW";
    content: string;
    createdAt: string;
  };
  event: {
    id: string;
    status: "COLLECTING" | "READY";
    title: string | null;
    startAt: string | null;
    endAt: string | null;
    timeZone: string | null;
    location: string | null;
    version: number;
  };
}

interface MessagesPageResponse {
  items: MessageResponse["message"][];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}
