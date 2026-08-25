import { MessageRow } from "../database/schemas";
import { MessageResponse } from "./messages.dto";

export function toMessageResponse(message: MessageRow): MessageResponse {
  if (message.kind !== "text" || message.content === null) {
    throw new Error("Cannot map a structured message as a text response.");
  }

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}
