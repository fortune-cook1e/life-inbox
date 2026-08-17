import { Body, Controller, Get, Post } from "@nestjs/common";
import { PlaygroundService } from "./playground.service";
import { SearchQueryDto } from "./playground.dto";
import { agent } from "./weather-agent";

import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";

const tracer = new LangChainTracer({ projectName: "Life-inbox-testing" });

@Controller("playground")
export class PlaygroundController {
  constructor(private readonly playgroundService: PlaygroundService) {}

  @Post("/search")
  async searchQuery(@Body() input: SearchQueryDto) {
    return await this.playgroundService.search(input.query);
  }

  @Get("/weather")
  async getWeather() {
    const result = await agent.invoke(
      {
        messages: [{ role: "user", content: "What's the weather in San Francisco?" }],
      },
      {
        callbacks: [tracer],
      },
    );
    return result.structuredResponse;
  }

  @Get("/question")
  async getQuestion() {
    // Implementation for getting a question
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "You are a helpful assistant. Please respond to the user's request only based on the given context.",
      ],
      ["user", "Question: {question}\nContext: {context}"],
    ]);

    const model = new ChatOpenAI({ modelName: "gpt-5-nano" });
    const outputParser = new StringOutputParser();
    const chain = prompt.pipe(model).pipe(outputParser);

    const question = "Can you summarize this morning's meetings?";
    const context = "During this morning's meeting, we solved all world conflict.";

    await chain.invoke(
      { question: question, context: context },
      {
        callbacks: [new LangChainTracer()],
      },
    );
  }
}
