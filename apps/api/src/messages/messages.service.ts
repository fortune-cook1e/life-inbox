import { Injectable } from "@nestjs/common";

import { EventAgentService } from "../agents/event-agent/event-agent.service";
import { MessagesRepository } from "./messages.repository";
import type { CreateMessageInput, MessageTurn } from "./messages.types";

const EVENT_AGENT_HISTORY_LIMIT = 10;

@Injectable()
export class MessagesService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly eventAgentService: EventAgentService,
  ) {}

  async createMessage(input: CreateMessageInput): Promise<MessageTurn> {
    const userMessage = await this.messagesRepository.createTextMessage({
      role: "user",
      content: input.content,
    });

    const history = await this.messagesRepository.findRecentBeforeSequence(
      userMessage.sequence,
      EVENT_AGENT_HISTORY_LIMIT,
    );

    const agentResult = await this.eventAgentService.run({
      content: input.content,
      sourceMessageId: userMessage.id,
      currentDateTime: new Date().toISOString(),
      userTimezone: input.timezone,
      history,
    });

    if (agentResult.kind === "text") {
      const assistantMessage = await this.messagesRepository.createTextMessage({
        role: "assistant",
        content: agentResult.response,
      });

      return {
        userMessage,
        assistantMessage,
      };
    }

    if (agentResult.clarification !== null) {
      const assistantMessage = await this.messagesRepository.createTextMessage({
        role: "assistant",
        content: agentResult.clarification,
      });

      return {
        userMessage,
        assistantMessage,
      };
    }

    return {
      userMessage,
      assistantMessage: agentResult.eventCardMessage,
    };
  }

  async getHistory() {
    return this.messagesRepository.findAll();
  }
}
