import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL(".env", import.meta.url)), quiet: true });

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schemas/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
