import { describe, expect, it } from "vitest";
import { z } from "zod";

import { clarificationAnswerSchema } from "../src/agent/life-inbox-agent.service.js";

describe("Agent tool schemas", () => {
  it("uses an OpenAI-compatible root object for clarification answers", () => {
    const jsonSchema = z.toJSONSchema(clarificationAnswerSchema);

    expect(jsonSchema).toMatchObject({
      type: "object",
      required: ["candidateToken", "field", "value", "evidence"],
      additionalProperties: false,
    });
    expect(jsonSchema).not.toHaveProperty("oneOf");
    expect(jsonSchema).not.toHaveProperty("anyOf");
  });
});
