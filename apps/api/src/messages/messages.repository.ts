import { Injectable } from "@nestjs/common";
import { asc } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { messages, type MessageRow } from "../database/schemas";

interface CreateTextMessageRecord {
  role: MessageRow["role"];
  content: string;
}

@Injectable()
export class MessagesRepository {
  constructor(private readonly database: DatabaseService) {}

  async createTextMessage(input: CreateTextMessageRecord): Promise<MessageRow> {
    const [message] = await this.database.db
      .insert(messages)
      .values({
        role: input.role,
        kind: "text",
        content: input.content,
        payload: null,
      })
      .returning();

    if (message === undefined) {
      throw new Error("Message insert returned no row.");
    }

    return message;
  }

  async findAll(): Promise<MessageRow[]> {
    return this.database.db.select().from(messages).orderBy(asc(messages.sequence));
  }
}
