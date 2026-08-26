import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { eventDraftIdSchema, updateEventDraftInputSchema } from "./event-drafts.types";

const eventDraftParamsSchema = z
  .object({
    draftId: eventDraftIdSchema,
  })
  .strict();

export class EventDraftParamsDto extends createZodDto(eventDraftParamsSchema) {}

export class UpdateEventDraftDto extends createZodDto(updateEventDraftInputSchema) {}
