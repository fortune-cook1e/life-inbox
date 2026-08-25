import { Body, Controller, Get, Post } from "@nestjs/common";

import { CreateMessageDto, MessageResponse, MessageTurnResponse } from "./messages.dto";
import { MessagesService } from "./messages.service";
import { toMessageResponse } from "./messages.mapper";

@Controller("messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async createMessage(@Body() input: CreateMessageDto): Promise<MessageTurnResponse> {
    const turn = await this.messagesService.createTextTurn(input.content);
    return [toMessageResponse(turn.userMessage), toMessageResponse(turn.assistantMessage)];
  }

  @Get()
  async getMessages(): Promise<MessageResponse[]> {
    const messages = await this.messagesService.getHistory();
    return messages.map(toMessageResponse);
  }
}
