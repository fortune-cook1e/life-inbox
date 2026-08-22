import type { PoolClient } from "pg";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getDatabaseUrl } from "../src/config/environment";

describe("event_drafts database invariants", () => {
  let pool: Pool | undefined;
  let client: PoolClient | undefined;

  beforeAll(() => {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  });

  beforeEach(async () => {
    if (pool === undefined) {
      throw new Error("Test database pool was not initialized.");
    }

    client = await pool.connect();
    await client.query("BEGIN");
  });

  afterEach(async () => {
    if (client === undefined) {
      return;
    }

    await client.query("ROLLBACK");
    client.release();
    client = undefined;
  });

  afterAll(async () => {
    await pool?.end();
    pool = undefined;
  });

  it("allows at most one event draft for each source message", async () => {
    if (client === undefined) {
      throw new Error("Test database client was not initialized.");
    }

    const database = client;

    const messageResult = await database.query<{ id: string }>(
      `
        INSERT INTO messages (role, content)
        VALUES ('user', $1)
        RETURNING id
      `,
      ["Meet Anna on August 24 at 15:00."],
    );

    const sourceMessageId = messageResult.rows[0]?.id;

    if (sourceMessageId === undefined) {
      throw new Error("Message insert returned no row.");
    }

    await database.query(
      `
        INSERT INTO event_drafts (
          source_message_id,
          title,
          start_at,
          timezone
        )
        VALUES ($1, $2, $3, $4)
      `,
      [sourceMessageId, "Meet Anna", "2026-08-24 15:00:00", "Europe/Stockholm"],
    );

    const duplicateInsert = database.query(
      `
        INSERT INTO event_drafts (
          source_message_id,
          title,
          start_at,
          timezone
        )
        VALUES ($1, $2, $3, $4)
      `,
      [sourceMessageId, "Duplicate meeting", "2026-08-24 16:00:00", "Europe/Stockholm"],
    );

    await expect(duplicateInsert).rejects.toMatchObject({
      code: "23505",
      constraint: "event_drafts_source_message_id_unique",
    });
  });
});
