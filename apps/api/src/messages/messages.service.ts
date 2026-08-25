import { Injectable } from "@nestjs/common";

import type { MessageRow } from "../database/schemas";
import { MessagesRepository } from "./messages.repository";
import { MessageTurn } from "./messages.dto";

@Injectable()
export class MessagesService {
  constructor(private readonly messagesRepository: MessagesRepository) {}

  async createUserTextMessage(content: string): Promise<MessageRow> {
    return this.messagesRepository.createTextMessage({
      role: "user",
      content,
    });
  }

  async createTextTurn(content: string): Promise<MessageTurn> {
    const assistantContent = `Received: ${content}`;

    return this.messagesRepository.createTextTurn({
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
