import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import type { FactoryProvider } from "@nestjs/common";

import { getOpenAiApiKey, getOpenAiModel } from "../../config/environment";

const EVENT_AGENT_TIMEOUT_MS = 15_000;
const EVENT_AGENT_MAX_RETRIES = 1;

export const EVENT_AGENT_MODEL = Symbol("EVENT_AGENT_MODEL");

export type EventAgentModel = Pick<BaseChatModel, "withStructuredOutput">;

export const eventAgentModelProvider: FactoryProvider<EventAgentModel> = {
  provide: EVENT_AGENT_MODEL,
  useFactory: () =>
    new ChatOpenAI({
      model: getOpenAiModel(),
      apiKey: getOpenAiApiKey(),
      maxRetries: EVENT_AGENT_MAX_RETRIES,
      timeout: EVENT_AGENT_TIMEOUT_MS,
    }),
};
