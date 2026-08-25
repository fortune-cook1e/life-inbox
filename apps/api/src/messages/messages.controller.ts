import { Body, Controller, Get, Post } from "@nestjs/common";

import { CreateMessageDto } from "./messages.dto";
import { toMessageResponse, toTextMessageResponse } from "./messages.mapper";
import { MessagesService } from "./messages.service";
import type {
  MessageResponse,
  TextMessageTurnResponse,
} from "./messages.types";

@Controller("messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async createMessage(@Body() input: CreateMessageDto): Promise<TextMessageTurnResponse> {
    const turn = await this.messagesService.createTextTurn(input.content);

    return [
      toTextMessageResponse(turn.userMessage),
      toTextMessageResponse(turn.assistantMessage),
    ];
  }

  @Get()
  async getMessages(): Promise<MessageResponse[]> {
    const messages = await this.messagesService.getHistory();
    return messages.map(toMessageResponse);
  }
}
