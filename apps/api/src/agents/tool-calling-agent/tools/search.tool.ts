import * as z from "zod";
import { ToolDefinition } from "../tool-calling-agent.types";

export const searchTool: ToolDefinition = {
  name: "search",
  description:
    "Search for information and return relevant results. Use for finding events, facts, or calendar data.",

  inputSchema: z.object({
    query: z.string().min(1, "Query must not be empty"),
  }),

  async handler(input: z.infer<typeof searchTool.inputSchema>) {
    // Simulate search results database
    const mockResults = [
      "Found event: Dentist appointment - Wednesday 2pm",
      "Found event: Team meeting - Thursday 10am",
      "Found event: Dinner with Alice - Friday 7pm",
    ];

    // Filter results based on query
    const filtered = mockResults.filter((result) =>
      result.toLowerCase().includes(input.query.toLowerCase()),
    );

    // Return results or "not found" message
    return filtered.length > 0 ? filtered.join("; ") : `No results found for "${input.query}"`;
  },
};
