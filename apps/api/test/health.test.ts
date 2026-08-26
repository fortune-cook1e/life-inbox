import { fakeModel } from "@langchain/core/testing";
import { API_SUCCESS_CODE, API_SUCCESS_MESSAGE } from "@life-inbox/shared";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";

import { EVENT_AGENT_MODEL } from "../src/agents/event-agent/event-agent-model.provider";
import { AppModule } from "../src/app.module";

describe("GET /health", () => {
  let app: INestApplication | undefined;
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    moduleRef = undefined;
  });

  it("returns the API health status", async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EVENT_AGENT_MODEL)
      .useValue(fakeModel())
      .compile();

    app = moduleRef.createNestApplication({
      logger: false,
    });

    app.setGlobalPrefix("api");

    await app.listen(0, "127.0.0.1");

    const response = await fetch(`${await app.getUrl()}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      code: API_SUCCESS_CODE,
      data: {
        status: "ok",
      },
      message: API_SUCCESS_MESSAGE,
    });
  });
});
