import { Injectable } from "@nestjs/common";
import { createAgent, tool, createMiddleware } from "langchain";
import { StateSchema } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";

import * as z from "zod";
import { searchQueryTool } from "./search-agent.tools";

const Answer = z.object({
  result: z.string(),
});

const MyState = new StateSchema({
  userName: z.string(),
});

const config = { configurable: { thread_id: crypto.randomUUID() } };

const stateMiddleware = createMiddleware({
  name: "StateExtension",
  stateSchema: MyState,
});

@Injectable()
export class SearchAgentService {
  async initAgent() {
    const agent = await createAgent({
      model: process.env.OPENAI_MODEL || "gpt-5-nano",
      tools: [searchQueryTool],
      // middleware: [stateMiddleware],
      // checkpointer: new MemorySaver(),
      systemPrompt: "You are a helpful assistant. Be concise and accurate.",
      responseFormat: Answer,
    });
    return agent;
  }

  async searchQuery(query: string): Promise<any> {
    const agent = await this.initAgent();
    const result = await agent.invoke(
      {
        messages: [{ role: "user", content: `What is ${query}` }],
      },
      // config,
    );
    return result.structuredResponse;
  }

  async getWeather(city: string): Promise<any> {
    // Simulate fetching weather data for the given city
    return {
      city,
      temperature: "25°C",
      condition: "Sunny",
    };
  }
}
