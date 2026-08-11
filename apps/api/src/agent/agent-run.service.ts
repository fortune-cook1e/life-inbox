import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { getDefaultTimeZone } from "../config/app-config.js";
import { PublicApiException } from "../common/http/public-api.exception.js";
import { DatabaseService } from "../database/database.service.js";
import { chatMessages } from "../database/schema.js";
import { LifeInboxAgentService } from "./life-inbox-agent.service.js";

export interface ProcessTextMessageInput {
  clientMessageId: string;
  content: string;
  timeZone?: string;
}

@Injectable()
export class AgentRunService {
  private readonly logger = new Logger(AgentRunService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly lifeInboxAgentService: LifeInboxAgentService,
  ) {}

  async processTextMessage(input: ProcessTextMessageInput) {
    const chatMessage = await this.createInputMessage(input);

    try {
      const outcome = await this.lifeInboxAgentService.run({
        inputMessageId: chatMessage.id,
        content: chatMessage.content,
        referenceDate: chatMessage.createdAt,
        defaultTimeZone: input.timeZone ?? getDefaultTimeZone(),
      });

      this.logger.debug(`Agent completed in ${outcome.stepCount} steps.`);

      const [reloadedMessage] = await this.databaseService.db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.id, chatMessage.id))
        .limit(1);

      if (!reloadedMessage) {
        throw new Error("The input ChatMessage could not be reloaded after the Agent run.");
      }

      return {
        outcome: outcome.outcome,
        chatMessage: reloadedMessage,
        assistantMessage: outcome.assistantMessage,
        event: outcome.event,
      };
    } catch (error) {
      this.logger.error("Agent run failed.", error instanceof Error ? error.stack : undefined);

      throw new PublicApiException(
        "Your message was saved, but the Agent could not finish processing it.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async createInputMessage(input: ProcessTextMessageInput) {
    const clientMessageId = input.clientMessageId.trim();
    const content = input.content.trim();

    if (!clientMessageId) {
      throw new PublicApiException("clientMessageId must not be blank.", HttpStatus.BAD_REQUEST);
    }

    if (!content) {
      throw new PublicApiException("content must not be blank.", HttpStatus.BAD_REQUEST);
    }

    const [chatMessage] = await this.databaseService.db
      .insert(chatMessages)
      .values({
        role: "USER",
        kind: "USER_TEXT",
        content,
        clientMessageId,
      })
      .returning();

    if (!chatMessage) {
      throw new Error("Creating the input ChatMessage did not return a row.");
    }

    return chatMessage;
  }
}
