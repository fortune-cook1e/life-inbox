import { MessageRow } from "../database/schemas";
import { MessageResponse } from "./messages.dto";

export function toMessageResponse(message: MessageRow): MessageResponse {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}
