import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema.js";

export function createDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create a database connection.");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool, schema });

  return { db, pool };
}
