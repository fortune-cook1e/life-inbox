import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterEach, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module";

describe("GET /health", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns the API health status", async () => {
    app = await NestFactory.create(AppModule, {
      logger: false,
    });

    await app.listen(0, "127.0.0.1");

    const response = await fetch(`${await app.getUrl()}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
    });
  });
});
