import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";

import { getDefaultTimeZone } from "../config/app-config.js";
import { DatabaseService } from "../database/database.service.js";
import { chatMessages } from "../database/schema.js";
import { AgentRunDidNotFinishError, LifeInboxAgentService } from "./life-inbox-agent.service.js";

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

      return {
        chatMessage,
        assistantMessage: outcome.assistantMessage,
        event: outcome.event,
      };
    } catch (error) {
      this.logger.error("Agent run failed.", error instanceof Error ? error.stack : undefined);

      const code =
        error instanceof AgentRunDidNotFinishError
          ? "AGENT_STEP_LIMIT_REACHED"
          : "AGENT_UNAVAILABLE";

      throw new ServiceUnavailableException({
        code,
        message: "Your message was saved, but the Agent could not finish processing it.",
      });
    }
  }

  private async createInputMessage(input: ProcessTextMessageInput) {
    const clientMessageId = input.clientMessageId.trim();
    const content = input.content.trim();

    if (!clientMessageId) {
      throw new BadRequestException("clientMessageId must not be blank.");
    }

    if (!content) {
      throw new BadRequestException("content must not be blank.");
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
