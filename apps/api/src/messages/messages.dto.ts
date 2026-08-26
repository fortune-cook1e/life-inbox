import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { isValidTimeZone } from "../utils/utils";

const createMessageSchema = z
  .object({
    content: z
      .string()
      .refine((value) => value.trim().length > 0, "Message content cannot be blank."),

    timezone: z.string().trim().min(1).refine(isValidTimeZone, {
      message: "Invalid timezone.",
    }),
  })
  .strict();

export class CreateMessageDto extends createZodDto(createMessageSchema) {}
