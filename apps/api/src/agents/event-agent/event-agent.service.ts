import { Inject, Injectable } from "@nestjs/common";

import { EventAgentRequestError } from "./event-agent.error";
import { eventAgentPrompt } from "./event-agent.prompt";
import {
  eventAgentInputSchema,
  eventAgentStructuredOutputSchema,
  type EventAgentInput,
  type EventAgentResult,
} from "./event-agent.schema";

import { EVENT_AGENT_MODEL, type EventAgentModel } from "./event-agent-model.provider";

@Injectable()
export class EventAgentService {
  private readonly chain;

  constructor(@Inject(EVENT_AGENT_MODEL) model: EventAgentModel) {
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
