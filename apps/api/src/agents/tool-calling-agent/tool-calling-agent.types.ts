import * as z from "zod";

// Tool definition schema - describes what a tool object must look like
export const ToolSchema = z.object({
  name: z.string().describe("Unique tool identifier"),
  description: z.string().describe("Human-readable tool purpose"),
  inputSchema: z.any().describe("Input validation schema (Zod schema)"),
  handler: z.function().describe("Async tool implementation"),
});

// Structured response from the agent - what we always return to the caller
export const ToolCallingResponseSchema = z.object({
  toolName: z.string(), // Which tool was selected
  toolInput: z.record(z.string(), z.any()), // What input was passed to the tool
  toolResult: z.any(), // What the tool returned (can be anything)
  success: z.boolean(), // Did the tool execution succeed?
  errorMessage: z.string().optional(), // If failed, what went wrong?
  reasoning: z.string().describe("Why this tool was chosen"),
});

export type ToolCallingResponse = z.infer<typeof ToolCallingResponseSchema>;
export type ToolDefinition = z.infer<typeof ToolSchema>;

// Agent's execution state - tracks progress as the agent tries to solve the problem
export interface AgentExecutionState {
  userQuery: string; // The original user question
  selectedTool?: string; // Which tool did we pick (if any)
  attemptCount: number; // How many times have we tried (prevents infinite loops)
  lastError?: string; // What was the last error we encountered
}
