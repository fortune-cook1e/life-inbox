import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { isValidTimeZone } from "../utils/time";

const createMessageSchema = z
  .object({
    content: z
      .string()
      .refine((value) => value.trim().length > 0, "Message content cannot be blank."),

    timezone: z
      .string()
      .trim()
      .min(1, {
        message: "Timezone is required.",
      })
      .refine(isValidTimeZone, {
        message: "Timezone must be a valid IANA timezone identifier.",
      }),
  })
  .strict();

export class CreateMessageDto extends createZodDto(createMessageSchema) {}
