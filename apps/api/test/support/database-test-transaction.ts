import type { PoolClient } from "pg";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

import { getDatabaseUrl } from "../../src/config/environment";

export interface TestDatabaseTransaction {
  getClient(): PoolClient;
}

export function useTestDatabaseTransaction(): TestDatabaseTransaction {
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

    try {
      await client.query("BEGIN");
    } catch (error) {
      client.release();
      client = undefined;
      throw error;
    }
  });

  afterEach(async () => {
    const activeClient = client;
    client = undefined;

    if (activeClient === undefined) {
      return;
    }

    try {
      await activeClient.query("ROLLBACK");
    } finally {
      activeClient.release();
    }
  });

  afterAll(async () => {
    await pool?.end();
    pool = undefined;
  });

  return {
    getClient(): PoolClient {
      if (client === undefined) {
        throw new Error("Test database transaction was not initialized.");
      }

      return client;
    },
  };
}
