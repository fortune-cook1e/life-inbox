import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import process from "node:process";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";

let app: INestApplication;
let baseUrl: string;
let databaseClient: Client;

beforeAll(async () => {
  app = await NestFactory.create(AppModule, {
    logger: false,
  });
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

it("POST /messages creates one internal matter for concurrent retries", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;
  const content = "Remind me to book the laundry room next Tuesday.";

  try {
    const before = await countRows(databaseClient);
    const request = {
      intent: "NEW_MATTER",
      clientMessageId,
      content,
    };

    const [firstResponse, secondResponse] = await Promise.all([
      postMessage(request),
      postMessage(request),
    ]);
    const [firstResponseBody, secondResponseBody] = await Promise.all([
      firstResponse.json() as Promise<MessageResponse>,
      secondResponse.json() as Promise<MessageResponse>,
    ]);

    expect([firstResponse.status, secondResponse.status]).toEqual([201, 201]);
    expect(firstResponseBody).toEqual(secondResponseBody);
    expect(firstResponseBody).toEqual({
      message: {
        id: expect.any(String),
        role: "USER",
        kind: "USER_TEXT",
        content,
        createdAt: expect.any(String),
      },
    });
    expect(firstResponseBody).not.toHaveProperty("lifeCase");
    expect(firstResponseBody.message).not.toHaveProperty("caseId");
    expect(firstResponseBody.message).not.toHaveProperty("clientMessageId");

    const afterConcurrentRetry = await countRows(databaseClient);

    expect(afterConcurrentRetry.lifeCases).toBe(before.lifeCases + 1);
    expect(afterConcurrentRetry.chatMessages).toBe(before.chatMessages + 1);

    const conflictResponse = await postMessage({
      ...request,
      content: "This is a different user action.",
    });

    expect(conflictResponse.status).toBe(409);
    await expect(conflictResponse.json()).resolves.toMatchObject({
      code: "CLIENT_MESSAGE_ID_REUSED",
    });

    expect(await countRows(databaseClient)).toEqual(afterConcurrentRetry);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it.each([
  {
    name: "blank content",
    body: {
      intent: "NEW_MATTER",
      clientMessageId: `message-test-${randomUUID()}`,
      content: "   ",
    },
  },
  {
    name: "an unsupported intent",
    body: {
      intent: "GENERAL",
      clientMessageId: `message-test-${randomUUID()}`,
      content: "Hello.",
    },
  },
  {
    name: "an unknown property",
    body: {
      intent: "NEW_MATTER",
      clientMessageId: `message-test-${randomUUID()}`,
      content: "Remind me to do laundry.",
      caseId: randomUUID(),
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
      olderPage.items
        .map((message) => message.id)
        .filter((id) => messageIds.includes(id)),
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

async function cleanupMatter(client: Client, clientMessageId: string) {
  const deletedMessages = await client.query(
    `
      delete from chat_messages
      where client_message_id = $1
      returning case_id
    `,
    [clientMessageId],
  );

  const caseIds = deletedMessages.rows
    .map((row) => row.case_id)
    .filter((caseId) => caseId !== null);

  if (caseIds.length > 0) {
    await client.query(
      `
        delete from life_cases
        where id = any($1::uuid[])
      `,
      [caseIds],
    );
  }
}

async function countRows(client: Client) {
  const result = await client.query(`
    select
      (select count(*)::integer from life_cases) as life_cases,
      (select count(*)::integer from chat_messages) as chat_messages
  `);

  return {
    lifeCases: result.rows[0].life_cases as number,
    chatMessages: result.rows[0].chat_messages as number,
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
}

interface MessagesPageResponse {
  items: MessageResponse["message"][];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}
