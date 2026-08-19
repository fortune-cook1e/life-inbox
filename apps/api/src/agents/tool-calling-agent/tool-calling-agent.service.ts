import { Injectable, Logger } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "langchain";

import { searchTool } from "./tools/search.tool";
import { getWeatherTool } from "./tools/get-weather.tool";
import { timezoneValidateTool } from "./tools/timezone-validate.tool";
import { ToolCallingResponse } from "./tool-calling-agent.types";

@Injectable()
export class ToolCallingAgentService {
  private readonly logger = new Logger(ToolCallingAgentService.name);
  private model: ChatOpenAI;

  constructor() {
    this.model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: process.env.OPENAI_MODEL || "gpt-5-nano",
    });
  }

  /**
   * Main entry point: Execute a user query by selecting and calling the appropriate tool.
   * Returns structured response with tool name, input, result, and success flag.
   */
  async executeQuery(userQuery: string): Promise<ToolCallingResponse> {
    this.logger.debug(`Executing query: "${userQuery}"`);

    // Step 1: Validate input
    const validation = this.validateQuery(userQuery);
    if (!validation.valid) {
      return {
        toolName: "validation_error",
        toolInput: {},
        toolResult: validation.error || "Invalid input",
        success: false,
        errorMessage: validation.error,
        reasoning: "Query validation failed before tool selection.",
      };
    }

    try {
      // Step 2: Execute with retry (in case of transient errors)
      return await this.executeWithRetry(async () => {
        return await this.selectAndExecuteTool(userQuery);
      });
    } catch (error) {
      this.logger.error(
        `Query execution failed: ${error instanceof Error ? error.message : error}`,
      );
      return {
        toolName: "unknown",
        toolInput: { userQuery },
        toolResult: null,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
        reasoning: "Fatal error during query execution.",
      };
    }
  }

  /**
   * Validate user query is not empty and reasonable length.
   */
  private validateQuery(query: string): { valid: boolean; error?: string } {
    if (!query || query.trim().length === 0) {
      return { valid: false, error: "Query cannot be empty." };
    }
    if (query.length > 500) {
      return { valid: false, error: "Query is too long (max 500 characters)." };
    }
    return { valid: true };
  }

  /**
   * Execute function with retry on transient errors.
   * Helps handle temporary network issues gracefully.
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, maxAttempts: number = 2): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);

        if (attempt < maxAttempts) {
          // Exponential backoff: 100ms * attempt number
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        }
      }
    }

    throw lastError || new Error("Max retry attempts exceeded.");
  }

  /**
   * Core Agent logic: Select the appropriate tool and execute it.
   */
  private async selectAndExecuteTool(userQuery: string): Promise<ToolCallingResponse> {
    // Get all tools in LangChain format
    const tools = this.getAvailableTools();

    // Call the model with tools bound to it
    // The model can see all available tools and their descriptions
    const response = await this.model.bindTools(tools).invoke([
      {
        role: "user",
        content: userQuery,
      },
    ]);

    // Check if model selected a tool
    const toolCall = response.tool_calls?.[0];
    if (!toolCall) {
      return {
        toolName: "none",
        toolInput: {},
        toolResult: "No tool was selected for this query.",
        success: false,
        reasoning: "The model did not identify a suitable tool.",
      };
    }

    // Extract the first tool call from the model's response
    const toolName = toolCall.name;
    const toolInput = toolCall.args as Record<string, any>;

    // Find the corresponding LangChain tool
    const selectedTool = tools.find((t) => t.name === toolName);
    if (!selectedTool) {
      throw new Error(`Tool "${toolName}" not found in available tools.`);
    }

    // Execute the tool
    let toolResult: any;
    try {
      toolResult = await selectedTool.invoke(toolInput);
    } catch (toolError) {
      return {
        toolName,
        toolInput,
        toolResult: null,
        success: false,
        errorMessage: toolError instanceof Error ? toolError.message : String(toolError),
        reasoning: `Tool execution failed: ${
          toolError instanceof Error ? toolError.message : "Unknown error"
        }`,
      };
    }

    // Return successful response
    return {
      toolName,
      toolInput,
      toolResult: String(toolResult),
      success: true,
      reasoning: `Selected tool "${toolName}" to answer the query.`,
    };
  }

  /**
   * Convert our tool objects to LangChain tool format.
   * This allows the model to understand and use them.
   */
  private getAvailableTools() {
    return [
      tool(async (input) => await searchTool.handler(input as never), {
        name: searchTool.name,
        description: searchTool.description,
        schema: searchTool.inputSchema,
      }),
      tool(async (input) => await getWeatherTool.handler(input as never), {
        name: getWeatherTool.name,
        description: getWeatherTool.description,
        schema: getWeatherTool.inputSchema,
      }),
      tool(async (input) => await timezoneValidateTool.handler(input as never), {
        name: timezoneValidateTool.name,
        description: timezoneValidateTool.description,
        schema: timezoneValidateTool.inputSchema,
      }),
    ];
  }
}
