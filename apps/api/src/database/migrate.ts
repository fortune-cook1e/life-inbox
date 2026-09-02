import { resolve } from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getDatabaseUrl, loadEnvironment } from "../config/environment";

async function runMigrations(): Promise<void> {
  loadEnvironment();

  const pool = new Pool({
    connectionString: getDatabaseUrl(),
  });

  try {
    const database = drizzle({ client: pool });

    await migrate(database, {
      migrationsFolder: resolve(__dirname, "../../drizzle"),
    });

    process.stdout.write("Database migrations completed.\n");
  } finally {
    await pool.end();
  }
}

void runMigrations().catch(() => {
  process.stderr.write("Database migration failed.\n");
  process.exitCode = 1;
});
