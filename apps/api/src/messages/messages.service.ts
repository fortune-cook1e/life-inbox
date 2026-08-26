import { Injectable } from "@nestjs/common";

import { EventAgentService } from "../agents/event-agent/event-agent.service";
import { EventDraftsService } from "../events/event-drafts.service";
import { MessagesRepository } from "./messages.repository";
import type { CreateMessageInput, MessageTurn } from "./messages.types";

@Injectable()
export class MessagesService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly eventAgentService: EventAgentService,
    private readonly eventDraftsService: EventDraftsService,
  ) {}

  async createMessage(input: CreateMessageInput): Promise<MessageTurn> {
    const userMessage = await this.messagesRepository.createTextMessage({
      role: "user",
      content: input.content,
    });

    const agentResult = await this.eventAgentService.extractEvent({
      content: input.content,
      currentDateTime: new Date().toISOString(),
      userTimezone: input.timezone,
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

    const { eventCardMessage } = await this.eventDraftsService.createPendingDraftWithInitialCard({
      sourceMessageId: userMessage.id,
      defaultTimezone: input.timezone,
      event: agentResult.event,
    });

    return {
      userMessage,
      assistantMessage: eventCardMessage,
    };
  }

  async getHistory() {
    return this.messagesRepository.findAll();
  }
}
