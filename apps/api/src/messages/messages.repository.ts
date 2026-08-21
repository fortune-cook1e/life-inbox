import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";
import { messages, type MessageRow, type NewMessageRow } from "../database/schemas";
import { CreateMessageTurnInput, MessageTurn } from "./messages.dto";
import { asc } from "drizzle-orm";

type CreateMessageRecord = Pick<NewMessageRow, "role" | "content">;

@Injectable()
export class MessagesRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: CreateMessageRecord): Promise<MessageRow> {
    const [message] = await this.database.db.insert(messages).values(input).returning();

    if (message === undefined) {
      throw new Error("Message insert returned no row.");
    }

    return message;
  }

  async createTurn(input: CreateMessageTurnInput): Promise<MessageTurn> {
    const insertedMessages = await this.database.db
      .insert(messages)
      .values([input.user, input.assistant])
      .returning();

    const userMessage = insertedMessages.find((message) => message.role === "user");

    const assistantMessage = insertedMessages.find((message) => message.role === "assistant");

    if (userMessage === undefined || assistantMessage === undefined) {
      throw new Error("Message turn insert did not return both messages.");
    }

    return {
      userMessage,
      assistantMessage,
    };
  }

  async findAll(): Promise<MessageRow[]> {
    return this.database.db.select().from(messages).orderBy(asc(messages.sequence));
  }
}
