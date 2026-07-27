import { Body, Controller, Post } from "@nestjs/common";

import { CreateMessageDto } from "./create-message.dto.js";
import { MessagesService } from "./messages.service.js";

@Controller("messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async createMessage(@Body() input: CreateMessageDto) {
    const { chatMessage } = await this.messagesService.captureNewMatter({
      clientMessageId: input.clientMessageId,
      content: input.content,
    });

    return {
      message: {
        id: chatMessage.id,
        role: chatMessage.role,
        kind: chatMessage.kind,
        content: chatMessage.content,
        createdAt: chatMessage.createdAt,
      },
    };
  }
}
