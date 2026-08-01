import { Body, Controller, Get, Post, Query } from "@nestjs/common";

import { AgentRunService } from "../agent/agent-run.service.js";
import { toEventResponse } from "../events/events.mapper.js";
import { MessageTimelineService } from "./message-timeline.service.js";
import { CreateMessageDto, ListMessagesQueryDto } from "./messages.dto.js";
import { toMessageResponse } from "./messages.mapper.js";

@Controller("messages")
export class MessagesController {
  constructor(
    private readonly messageTimelineService: MessageTimelineService,
    private readonly agentRunService: AgentRunService,
  ) {}

  @Get()
  async listMessages(@Query() query: ListMessagesQueryDto) {
    const result = await this.messageTimelineService.listRecentMessages({
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
    const { assistantMessage, chatMessage, event } = await this.agentRunService.processTextMessage({
      clientMessageId: input.clientMessageId,
      content: input.content,
      timeZone: input.timeZone,
    });

    return {
      message: toMessageResponse(chatMessage),
      assistantMessage: toMessageResponse(assistantMessage),
      event: toEventResponse(event),
    };
  }
}
