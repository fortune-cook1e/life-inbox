import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { loadEnvironment } from "../config/environment.js";
import * as schema from "./schema.js";

export function createDatabase(connectionString?: string) {
  loadEnvironment();

  const resolvedConnectionString = connectionString ?? process.env.DATABASE_URL;

  if (!resolvedConnectionString) {
    throw new Error("DATABASE_URL is required to create a database connection.");
  }

  const pool = new Pool({
    connectionString: resolvedConnectionString,
    connectionTimeoutMillis: 2_000,
    max: 10,
  });
  const db = drizzle({ client: pool, schema });

  return { db, pool };
}

export type DatabaseConnection = ReturnType<typeof createDatabase>;
