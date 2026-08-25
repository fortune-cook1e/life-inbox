import { Injectable } from "@nestjs/common";

import type { MessageRow } from "../database/schemas";
import { MessagesRepository } from "./messages.repository";
import {
  eventCardPayloadSchema,
  type EventCardPayload,
  type TextMessageTurn,
} from "./messages.types";

@Injectable()
export class MessagesService {
  constructor(private readonly messagesRepository: MessagesRepository) {}

  async createUserTextMessage(content: string): Promise<MessageRow> {
    return this.messagesRepository.createTextMessage({
      role: "user",
      content,
    });
  }

  async createTextTurn(content: string): Promise<TextMessageTurn> {
    const assistantContent = `Received: ${content}`;

    return this.messagesRepository.createTextTurn({
      userContent: content,
      assistantContent,
    });
  }

  async createEventCardMessage(payload: EventCardPayload): Promise<MessageRow> {
    const validatedPayload = eventCardPayloadSchema.parse(payload);

    return this.messagesRepository.createEventCardMessage(validatedPayload);
  }

  async getHistory(): Promise<MessageRow[]> {
    return this.messagesRepository.findAll();
  }
}
