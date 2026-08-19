import * as z from "zod";
import { ToolDefinition } from "../tool-calling-agent.types";

// List of valid IANA timezones (subset for this implementation)
const VALID_TIMEZONES = new Set([
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "America/Denver",
  "America/Anchorage",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Vienna",
  "Europe/Prague",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",
  "Pacific/Auckland",
  "Pacific/Honolulu",
]);

export const timezoneValidateTool: ToolDefinition = {
  name: "timezone_validate",
  description:
    "Validate if a timezone string is a valid IANA timezone. Returns validity and explanation.",

  inputSchema: z.object({
    timezone: z.string().min(1, "Timezone must not be empty"),
  }),

  async handler(input: z.infer<typeof timezoneValidateTool.inputSchema>) {
    const isValid = VALID_TIMEZONES.has(input.timezone);

    if (isValid) {
      return `✓ "${input.timezone}" is a valid IANA timezone.`;
    } else {
      return `✗ "${input.timezone}" is not a recognized timezone. Valid examples: America/New_York, Europe/London, Asia/Tokyo, Australia/Sydney.`;
    }
  },
};
