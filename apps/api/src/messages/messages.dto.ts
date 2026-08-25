import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { MessageRow } from "../database/schemas";

const CreateMessageSchema = z
  .object({
    content: z
      .string()
      .refine((value) => value.trim().length > 0, "Message content cannot be blank."),
  })
  .strict();

export class CreateMessageDto extends createZodDto(CreateMessageSchema) {}

export interface CreateTextMessageTurnInput {
  user: {
    role: "user";
    content: string;
  };
  assistant: {
    role: "assistant";
    content: string;
  };
}

export interface MessageTurn {
  userMessage: MessageRow;
  assistantMessage: MessageRow;
}

export interface MessageResponse {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export type MessageTurnResponse = [userMessage: MessageResponse, assistantMessage: MessageResponse];
