import { Injectable } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";

import { getOpenAiApiKey, getOpenAiModel } from "../../config/environment";
import { EventAgentRequestError } from "./event-agent.error";
import { eventAgentPrompt } from "./event-agent.prompt";
import {
  eventAgentInputSchema,
  eventAgentStructuredOutputSchema,
  type EventAgentInput,
  type EventAgentResult,
} from "./event-agent.schema";

const EVENT_AGENT_TIMEOUT_MS = 15_000;
const EVENT_AGENT_MAX_RETRIES = 1;

@Injectable()
export class EventAgentService {
  private readonly chain;

  constructor() {
    const model = new ChatOpenAI({
      model: getOpenAiModel(),
      apiKey: getOpenAiApiKey(),
      maxRetries: EVENT_AGENT_MAX_RETRIES,
      timeout: EVENT_AGENT_TIMEOUT_MS,
    });

    const structuredModel = model.withStructuredOutput(eventAgentStructuredOutputSchema, {
      name: "event_extraction",
      strict: true,
    });

    this.chain = eventAgentPrompt.pipe(structuredModel);
  }

  async extractEvent(input: EventAgentInput): Promise<EventAgentResult> {
    const validatedInput = eventAgentInputSchema.parse(input);

    try {
      const output = await this.chain.invoke(validatedInput);
      return output.result;
    } catch (error) {
      throw new EventAgentRequestError(error);
    }
  }
}
