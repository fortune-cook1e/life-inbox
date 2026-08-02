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

it("DELETE /cases/:caseId deletes the Case and all related Messages and Events", async () => {
  const targetCaseId = randomUUID();
  const otherCaseId = randomUUID();

  try {
    await seedCase(targetCaseId, "Target");
    await seedCase(otherCaseId, "Other");

    const response = await fetch(`${baseUrl}/cases/${targetCaseId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    await expect(countCaseGraph(targetCaseId)).resolves.toEqual({
      cases: 0,
      messages: 0,
      events: 0,
    });
    await expect(countCaseGraph(otherCaseId)).resolves.toEqual({
      cases: 1,
      messages: 2,
      events: 1,
    });
  } finally {
    await cleanupCase(targetCaseId);
    await cleanupCase(otherCaseId);
  }
});

it("DELETE /cases/:caseId returns 404 without deleting other data", async () => {
  const existingCaseId = randomUUID();

  try {
    await seedCase(existingCaseId, "Existing");

    const response = await fetch(`${baseUrl}/cases/${randomUUID()}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
    await expect(countCaseGraph(existingCaseId)).resolves.toEqual({
      cases: 1,
      messages: 2,
      events: 1,
    });
  } finally {
    await cleanupCase(existingCaseId);
  }
});

async function seedCase(caseId: string, label: string) {
  await databaseClient.query(
    `
      insert into life_cases (id)
      values ($1)
    `,
    [caseId],
  );
  await databaseClient.query(
    `
      insert into chat_messages (case_id, role, kind, content)
      values
        ($1, 'USER', 'USER_TEXT', $2),
        ($1, 'ASSISTANT', 'EVENT_PREVIEW', $3)
    `,
    [caseId, `${label} user message`, `${label} assistant message`],
  );
  await databaseClient.query(
    `
      insert into events (case_id, status, title, start_at, time_zone)
      values ($1, 'READY', $2, '2026-08-07T08:00:00.000Z', 'Europe/Stockholm')
    `,
    [caseId, `${label} event`],
  );
}

async function countCaseGraph(caseId: string) {
  const result = await databaseClient.query(
    `
      select
        (select count(*)::integer from life_cases where id = $1) as cases,
        (select count(*)::integer from chat_messages where case_id = $1) as messages,
        (select count(*)::integer from events where case_id = $1) as events
    `,
    [caseId],
  );

  return result.rows[0] as {
    cases: number;
    messages: number;
    events: number;
  };
}

async function cleanupCase(caseId: string) {
  await databaseClient.query("delete from chat_messages where case_id = $1", [caseId]);
  await databaseClient.query("delete from events where case_id = $1", [caseId]);
  await databaseClient.query("delete from life_cases where id = $1", [caseId]);
}
