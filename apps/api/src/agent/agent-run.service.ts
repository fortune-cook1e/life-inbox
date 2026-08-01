import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";

import { getDefaultTimeZone } from "../config/app-config.js";
import { DatabaseService } from "../database/database.service.js";
import { chatMessages } from "../database/schema.js";
import { AgentToolsService } from "./agent-tools.service.js";
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
    private readonly agentToolsService: AgentToolsService,
  ) {}

  async processTextMessage(input: ProcessTextMessageInput) {
    const chatMessage = await this.captureInputMessage(input);
    const existingOutcome = await this.agentToolsService.findOutcomeForMessage(chatMessage.id);

    // if the message has caseId, it means the agent has already processed this message and created a case for it. In that case, we can return the existing outcome without running the agent again.
    if (existingOutcome) {
      return {
        chatMessage,
        ...existingOutcome,
      };
    }

    try {
      const outcome = await this.lifeInboxAgentService.run({
        inputMessageId: chatMessage.id,
        content: chatMessage.content,
        referenceDate: chatMessage.createdAt,
        defaultTimeZone: input.timeZone ?? getDefaultTimeZone(),
        existingCaseId: chatMessage.caseId,
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
        message: "The Agent could not finish this message. Please retry.",
      });
    }
  }

  private async captureInputMessage(input: ProcessTextMessageInput) {
    const clientMessageId = input.clientMessageId.trim();
    const content = input.content.trim();

    if (!clientMessageId) {
      throw new BadRequestException("clientMessageId must not be blank.");
    }

    if (!content) {
      throw new BadRequestException("content must not be blank.");
    }

    const [insertedMessage] = await this.databaseService.db
      .insert(chatMessages)
      .values({
        role: "USER",
        kind: "USER_TEXT",
        content,
        clientMessageId,
      })
      .onConflictDoNothing({ target: chatMessages.clientMessageId })
      .returning();

    if (insertedMessage) {
      return insertedMessage;
    }

    const [existingMessage] = await this.databaseService.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.clientMessageId, clientMessageId))
      .limit(1);

    if (!existingMessage) {
      throw new Error("The idempotent ChatMessage could not be loaded after a conflict.");
    }

    if (existingMessage.content !== content) {
      throw new ConflictException({
        code: "CLIENT_MESSAGE_ID_REUSED",
        message: "clientMessageId was already used for different content.",
      });
    }

    return existingMessage;
  }
}
