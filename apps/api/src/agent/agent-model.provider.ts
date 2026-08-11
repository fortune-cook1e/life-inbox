import { createOpenAI, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import { loadEnvironment } from "../config/environment.js";

export interface AgentLanguageModelConfig {
  model: LanguageModel;
  providerOptions?: {
    openai: OpenAILanguageModelResponsesOptions;
  };
}

export type AgentLanguageModelFactory = () => AgentLanguageModelConfig;

export function createAgentLanguageModel(): AgentLanguageModelConfig {
  loadEnvironment();

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to run the LifeInbox Agent.");
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5-nano";
  const openai = createOpenAI({ apiKey });

  return {
    model: openai.responses(model),
    providerOptions: {
      openai: {
        parallelToolCalls: false,
        reasoningEffort: "low",
        reasoningSummary: null,
        store: false,
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  };
}
