import { RunnableLambda } from "@langchain/core/runnables";
import { fakeModel } from "@langchain/core/testing";
import { Test, type TestingModule } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentsModule } from "../src/agents/agents.module";
import { EVENT_AGENT_MODEL } from "../src/agents/event-agent/event-agent-model.provider";
import { EventAgentRequestError } from "../src/agents/event-agent/event-agent.error";
import type {
  EventAgentInput,
  EventAgentResult,
} from "../src/agents/event-agent/event-agent.schema";
import { EventAgentService } from "../src/agents/event-agent/event-agent.service";

const input = {
  content: "Meet Anna tomorrow at 3 PM.",
  currentDateTime: "2026-08-24T10:00:00+02:00",
  userTimezone: "Europe/Stockholm",
} satisfies EventAgentInput;

async function createTestingModule(model: ReturnType<typeof fakeModel>): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [AgentsModule],
  })
    .overrideProvider(EVENT_AGENT_MODEL)
    .useValue(model)
    .compile();
}

describe("EventAgentService", () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
    vi.restoreAllMocks();
  });

  it("returns the structured Event result produced by the injected model", async () => {
    const expectedResult: EventAgentResult = {
      kind: "event",
      event: {
        title: "Meet Anna",
        startAt: "2026-08-25T15:00:00",
        endAt: null,
        timezone: null,
        location: null,
        description: null,
      },
    };

    const model = fakeModel().structuredResponse({
      result: expectedResult,
    });

    moduleRef = await createTestingModule(model);

    const service = moduleRef.get(EventAgentService);

    await expect(service.extractEvent(input)).resolves.toEqual(expectedResult);
  });

  it("maps model invocation failures and preserves the original cause", async () => {
    const providerError = new Error("Model provider unavailable");
    const model = fakeModel();

    const throwingStructuredModel = RunnableLambda.from(async () => {
      throw providerError;
    });

    vi.spyOn(model, "withStructuredOutput").mockReturnValue(
      throwingStructuredModel as ReturnType<typeof model.withStructuredOutput>,
    );

    moduleRef = await createTestingModule(model);

    const service = moduleRef.get(EventAgentService);

    const actualError = await service.extractEvent(input).catch((error: unknown) => error);

    expect(actualError).toBeInstanceOf(EventAgentRequestError);
    expect((actualError as EventAgentRequestError).cause).toBe(providerError);
    expect((actualError as EventAgentRequestError).publicMessage).toBe(
      "The Event assistant could not process your message. Please try again.",
    );
  });
});
