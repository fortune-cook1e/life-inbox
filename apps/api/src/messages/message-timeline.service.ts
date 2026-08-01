import { Injectable } from "@nestjs/common";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { DatabaseService } from "../database/database.service.js";
import { chatMessages } from "../database/schema.js";
import { decodeMessageCursor, encodeMessageCursor } from "./messages.cursor.js";

export interface ListRecentMessagesInput {
  limit: number;
  cursor?: string;
}

@Injectable()
export class MessageTimelineService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listRecentMessages(input: ListRecentMessagesInput) {
    const cursor = input.cursor ? decodeMessageCursor(input.cursor) : undefined;
    const cursorFilter = cursor
      ? or(
          lt(chatMessages.createdAt, cursor.createdAt),
          and(eq(chatMessages.createdAt, cursor.createdAt), lt(chatMessages.id, cursor.id)),
        )
      : undefined;

    const newestFirst = await this.databaseService.db
      .select({
        id: chatMessages.id,
        role: chatMessages.role,
        kind: chatMessages.kind,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(cursorFilter)
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(input.limit + 1);

    const hasMore = newestFirst.length > input.limit;
    const page = newestFirst.slice(0, input.limit);
    const oldestMessage = page.at(-1);

    return {
      messages: page.reverse(),
      pageInfo: {
        hasMore,
        nextCursor: hasMore && oldestMessage ? encodeMessageCursor(oldestMessage) : null,
      },
    };
  }
}
