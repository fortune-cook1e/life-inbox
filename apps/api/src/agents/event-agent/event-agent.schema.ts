import { z } from "zod";

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const eventAgentInputSchema = z
  .object({
    content: z.string().trim().min(1, { message: "Content is required" }),
    currentDateTime: z.iso.datetime({ offset: true }),
    userTimezone: z.string().trim().min(1).refine(isValidTimeZone, { message: "Invalid timezone" }),
  })
  .strict();

const eventCandidateSchema = z
  .object({
    title: z
      .string()
      .nullable()
      .describe("Event title supported by the user message, or null when missing."),

    startAt: z
      .string()
      .nullable()
      .describe(
        "Local event start in YYYY-MM-DDTHH:mm:ss format, or null when the date or time is missing.",
      ),

    endAt: z
      .string()
      .nullable()
      .describe(
        "Local event end in YYYY-MM-DDTHH:mm:ss format, or null when the user did not provide it.",
      ),

    timezone: z
      .string()
      .nullable()
      .describe(
        "Explicit IANA timezone from the user message, or null when no timezone was stated.",
      ),

    location: z
      .string()
      .nullable()
      .describe("Event location supported by the user message, or null when missing."),

    description: z
      .string()
      .nullable()
      .describe("Additional event details supported by the message, or null when missing."),
  })
  .strict();

const eventAgentResultSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("event"),
      event: eventCandidateSchema,
    })
    .strict(),

  z
    .object({
      kind: z.literal("text"),
      response: z
        .string()
        .describe("A short response explaining that the assistant only helps create events."),
    })
    .strict(),
]);

export const eventAgentStructuredOutputSchema = z
  .object({
    result: eventAgentResultSchema,
  })
  .strict();

export type EventAgentInput = z.infer<typeof eventAgentInputSchema>;
export type EventAgentResult = z.infer<typeof eventAgentResultSchema>;
