import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service.js";
import { chatMessages, lifeCases } from "../database/schema.js";

export interface CaptureNewMatterInput {
  clientMessageId: string;
  content: string;
}

@Injectable()
export class MessagesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async captureNewMatter(input: CaptureNewMatterInput) {
    const clientMessageId = input.clientMessageId.trim();
    const content = input.content.trim();

    if (!clientMessageId) {
      throw new BadRequestException("clientMessageId must not be blank.");
    }

    if (!content) {
      throw new BadRequestException("content must not be blank.");
    }

    try {
      const result = await this.databaseService.db.transaction(async (transaction) => {
        const [lifeCase] = await transaction.insert(lifeCases).values({}).returning();

        if (!lifeCase) {
          throw new Error("Creating a LifeCase did not return a row.");
        }

        const [chatMessage] = await transaction
          .insert(chatMessages)
          .values({
            caseId: lifeCase.id,
            role: "USER",
            kind: "USER_TEXT",
            content,
            clientMessageId,
          })
          .returning();

        if (!chatMessage) {
          throw new Error("Creating a ChatMessage did not return a row.");
        }

        return {
          lifeCase,
          chatMessage,
        };
      });

      return result;
    } catch (error) {
      if (!isClientMessageIdUniqueViolation(error)) {
        throw error;
      }

      const existing = await this.findByClientMessageId(clientMessageId);

      if (!existing) {
        throw error;
      }

      console.log({ existing });

      if (existing.chatMessage.content !== content) {
        throw new ConflictException({
          code: "CLIENT_MESSAGE_ID_REUSED",
          message: "clientMessageId was already used for different content.",
        });
      }

      return existing;
    }
  }

  private async findByClientMessageId(clientMessageId: string) {
    const [existing] = await this.databaseService.db
      .select({
        lifeCase: lifeCases,
        chatMessage: chatMessages,
      })
      .from(chatMessages)
      .innerJoin(lifeCases, eq(chatMessages.caseId, lifeCases.id))
      .where(eq(chatMessages.clientMessageId, clientMessageId))
      .limit(1);

    return existing;
  }
}

function isClientMessageIdUniqueViolation(error: unknown) {
  let currentError = error;

  while (typeof currentError === "object" && currentError !== null) {
    if (
      "code" in currentError &&
      currentError.code === "23505" &&
      "constraint" in currentError &&
      currentError.constraint === "chat_messages_client_message_id_unique"
    ) {
      return true;
    }

    if (!("cause" in currentError)) {
      return false;
    }

    currentError = currentError.cause;
  }

  return false;
}
