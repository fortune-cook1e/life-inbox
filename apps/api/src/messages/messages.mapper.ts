import type { InferSelectModel } from "drizzle-orm";

import { chatMessages } from "../database/schema.js";

type ChatMessage = InferSelectModel<typeof chatMessages>;
type MessageResponseSource = Pick<ChatMessage, "id" | "role" | "kind" | "content" | "createdAt">;

export type MessageResponse = MessageResponseSource;

export function toMessageResponse(message: MessageResponseSource): MessageResponse {
  return {
    id: message.id,
    role: message.role,
    kind: message.kind,
    content: message.content,
    createdAt: message.createdAt,
  };
}
