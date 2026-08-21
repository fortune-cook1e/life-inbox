import { Injectable } from "@nestjs/common";

import type { MessageRow } from "../database/schemas";
import { MessagesRepository } from "./messages.repository";
import { MessageTurn } from "./messages.dto";

@Injectable()
export class MessagesService {
  constructor(private readonly messagesRepository: MessagesRepository) {}

  async createUserMessage(content: string): Promise<MessageRow> {
    return this.messagesRepository.create({
      role: "user",
      content,
    });
  }

  async createTurn(content: string): Promise<MessageTurn> {
    const assistantContent = `Received: ${content}`;

    return this.messagesRepository.createTurn({
      user: {
        role: "user",
        content,
      },
      assistant: {
        role: "assistant",
        content: assistantContent,
      },
    });
  }

  async getHistory(): Promise<MessageRow[]> {
    return this.messagesRepository.findAll();
  }
}
