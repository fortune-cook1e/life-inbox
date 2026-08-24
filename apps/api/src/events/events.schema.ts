import { z } from "zod";

const localDateTimeSchema = z.iso
  .datetime({
    local: true,
    precision: 0,
  })
  .refine((value) => !value.endsWith("Z"), {
    message: "Event Draft datetime must not include timezone information.",
  });

export const createPendingEventDraftInputSchema = z
  .object({
    sourceMessageId: z.uuid(),

    defaultTimezone: z.string().trim().min(1),

    event: z
      .object({
        title: z.string().nullable(),
        startAt: localDateTimeSchema.nullable(),
        endAt: localDateTimeSchema.nullable(),
        timezone: z.string().trim().min(1).nullable(),
        location: z.string().nullable(),
        description: z.string().nullable(),
      })
      .strict(),
  })
  .strict();

export type CreatePendingEventDraftInput = z.input<typeof createPendingEventDraftInputSchema>;
