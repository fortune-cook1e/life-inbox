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
