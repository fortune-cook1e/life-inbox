import { config } from "dotenv";
import { resolve } from "node:path";

const envPath = resolve(__dirname, "../../.env");

const DEFAULT_API_PORT = 3001;

export function loadEnvironment(): void {
  config({
    path: envPath,
    quiet: true,
  });
}

export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is required");
  }

  return value;
}

export function getApiPort(): number {
  const value = process.env.API_PORT;

  if (value === undefined) {
    return DEFAULT_API_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`API_PORT must be an integer between 1 and 65535. Received: ${value}`);
  }

  return port;
}
