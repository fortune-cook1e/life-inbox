import { config } from "dotenv";
import { resolve } from "node:path";

const envPath = resolve(__dirname, "../../.env");

const DEFAULT_API_PORT = 3001;

type RequiredEnvironmentVariable = "DATABASE_URL" | "OPENAI_API_KEY" | "OPENAI_MODEL";

export function loadEnvironment(): void {
  config({
    path: envPath,
    quiet: true,
  });
}

function getRequiredEnvironmentVariable(name: RequiredEnvironmentVariable): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export function getDatabaseUrl(): string {
  return getRequiredEnvironmentVariable("DATABASE_URL");
}

export function getOpenAiApiKey(): string {
  return getRequiredEnvironmentVariable("OPENAI_API_KEY");
}

export function getOpenAiModel(): string {
  return getRequiredEnvironmentVariable("OPENAI_MODEL");
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
