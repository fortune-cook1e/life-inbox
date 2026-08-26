import { z } from "zod";
import type { MessageRow } from "../database/schemas";
import { isValidTimeZone } from "../utils/utils";

const localDateTimeSchema = z.iso
  .datetime({
    local: true,
    precision: 0,
  })
  .refine((value) => !value.endsWith("Z"), {
    message: "Event Card datetime must not include timezone information.",
  });

export const eventCardPayloadSchema = z
  .object({
    draftId: z.uuid(),
    title: z.string().nullable(),
    startAt: localDateTimeSchema.nullable(),
    endAt: localDateTimeSchema.nullable(),
    timezone: z.string().trim().min(1).refine(isValidTimeZone, {
      message: "Invalid Event Card timezone.",
    }),
    location: z.string().nullable(),
    description: z.string().nullable(),
  })
  .strict();

export type EventCardPayload = z.infer<typeof eventCardPayloadSchema>;

export interface TextMessageResponse {
  id: string;
  role: "user" | "assistant";
  kind: "text";
  content: string;
  createdAt: string;
}

export interface EventCardMessageResponse {
  id: string;
  role: "assistant";
  kind: "event_card";
  payload: EventCardPayload;
  createdAt: string;
}

export type MessageResponse = TextMessageResponse | EventCardMessageResponse;

export interface MessageTurn {
  userMessage: MessageRow;
  assistantMessage: MessageRow;
}

export type MessageTurnResponse = [
  userMessage: TextMessageResponse,
  assistantMessage: MessageResponse,
];
