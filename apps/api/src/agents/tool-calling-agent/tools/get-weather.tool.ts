import * as z from "zod";
import { ToolDefinition } from "../tool-calling-agent.types";

// Mock weather database
const MOCK_WEATHER = {
  "san francisco": { temperature: "62°F", condition: "Cloudy", humidity: "75%" },
  "new york": { temperature: "72°F", condition: "Sunny", humidity: "60%" },
  london: { temperature: "59°F", condition: "Rainy", humidity: "85%" },
  tokyo: { temperature: "78°F", condition: "Sunny", humidity: "70%" },
};

export const getWeatherTool: ToolDefinition = {
  name: "get_weather",
  description: "Get current weather for a city. Returns temperature, condition, and humidity.",

  inputSchema: z.object({
    city: z.string().min(1, "City name must not be empty"),
  }),

  async handler(input: z.infer<typeof getWeatherTool.inputSchema>) {
    const normalizedCity = input.city.toLowerCase();

    // Look up in mock database, or use default weather
    const weather = MOCK_WEATHER[normalizedCity as keyof typeof MOCK_WEATHER] || {
      temperature: "68°F",
      condition: "Partly Cloudy",
      humidity: "70%",
    };

    return `Weather in ${input.city}: ${weather.temperature}, ${weather.condition}, Humidity: ${weather.humidity}`;
  },
};
