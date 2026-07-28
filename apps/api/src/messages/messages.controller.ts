import { Body, Controller, Get, Post, Query } from "@nestjs/common";

import { CreateMessageDto, ListMessagesQueryDto } from "./messages.dto.js";
import { toMessageResponse } from "./messages.mapper.js";
import { MessagesService } from "./messages.service.js";

@Controller("messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async listMessages(@Query() query: ListMessagesQueryDto) {
    const result = await this.messagesService.listRecentMessages({
      limit: query.limit,
      cursor: query.cursor,
    });

    return {
      items: result.messages.map(toMessageResponse),
      pageInfo: result.pageInfo,
    };
  }

  @Post()
  async createMessage(@Body() input: CreateMessageDto) {
    const { chatMessage } = await this.messagesService.captureNewMatter({
      clientMessageId: input.clientMessageId,
      content: input.content,
    });

    return {
      message: toMessageResponse(chatMessage),
    };
  }
}
