import { Injectable } from "@nestjs/common";

import { EventAgentService } from "../agents/event-agent/event-agent.service";
import type { MessageRow } from "../database/schemas";
import { EventsService } from "../events/events.service";
import type { CreateMessageDto } from "./messages.dto";
import { MessagesRepository } from "./messages.repository";
import {
  eventCardPayloadSchema,
  type EventCardPayload,
  type MessageTurn,
} from "./messages.types";

@Injectable()
export class MessagesService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly eventAgentService: EventAgentService,
    private readonly eventsService: EventsService,
  ) {}

  async createMessage(input: CreateMessageDto): Promise<MessageTurn> {
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

    const { eventCardMessage } = await this.eventsService.createPendingDraftWithInitialCard({
      sourceMessageId: userMessage.id,
      defaultTimezone: input.timezone,
      event: agentResult.event,
    });

    return {
      userMessage,
      assistantMessage: eventCardMessage,
    };
  }

  async createEventCardMessage(payload: EventCardPayload): Promise<MessageRow> {
    const validatedPayload = eventCardPayloadSchema.parse(payload);

    return this.messagesRepository.createEventCardMessage(validatedPayload);
  }

  async getHistory(): Promise<MessageRow[]> {
    return this.messagesRepository.findAll();
  }
}
