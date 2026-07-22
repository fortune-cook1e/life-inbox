import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://life_inbox:life_inbox@localhost:5432/life_inbox";

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query("CREATE EXTENSION IF NOT EXISTS vector");
  console.log("pgvector extension is ready.");
} finally {
  await client.end();
}
