import { Body, Controller, Get, Post } from "@nestjs/common";

import { CreateMessageDto } from "./messages.dto";
import { toMessageResponse, toTextMessageResponse } from "./messages.mapper";
import { MessagesService } from "./messages.service";
import type {
  MessageResponse,
  MessageTurnResponse,
} from "./messages.types";

@Controller("messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async createMessage(@Body() input: CreateMessageDto): Promise<MessageTurnResponse> {
    const turn = await this.messagesService.createMessage(input);

    return [
      toTextMessageResponse(turn.userMessage),
      toMessageResponse(turn.assistantMessage),
    ];
  }

  @Get()
  async getMessages(): Promise<MessageResponse[]> {
    const messages = await this.messagesService.getHistory();
    return messages.map(toMessageResponse);
  }
}
