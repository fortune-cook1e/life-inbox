import { tool } from "langchain";
import * as z from "zod";

export const searchQueryTool = tool(({ query }) => `Search results for: ${query}`, {
  name: "search",
  description: "Search for a query and return a short summary.",
  schema: z.object({ query: z.string() }),
});
