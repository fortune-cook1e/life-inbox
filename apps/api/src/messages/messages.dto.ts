import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const createMessageSchema = z
  .object({
    content: z
      .string()
      .refine((value) => value.trim().length > 0, "Message content cannot be blank."),
  })
  .strict();

export class CreateMessageDto extends createZodDto(createMessageSchema) {}
