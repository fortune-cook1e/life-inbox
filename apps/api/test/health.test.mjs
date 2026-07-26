/* global fetch */

import assert from "node:assert/strict";
import test from "node:test";

import { NestFactory } from "@nestjs/core";

const { loadEnvironment } = await import("../dist/config/environment.js");
loadEnvironment();

const { AppModule } = await import("../dist/app.module.js");
const { HealthService } = await import("../dist/health/health.service.js");

test("liveness does not depend on the database", () => {
  let pingCalls = 0;
  const healthService = new HealthService({
    async ping() {
      pingCalls += 1;
      throw new Error("database should not be called");
    },
  });

  assert.deepEqual(healthService.getLiveness(), {
    status: "ok",
    service: "life-inbox-api",
    checks: {
      process: "up",
    },
  });
  assert.equal(pingCalls, 0);
});

test("readiness converts a database failure into service unavailable", async () => {
  const healthService = new HealthService({
    async ping() {
      throw new Error("database unavailable");
    },
  });

  await assert.rejects(
    healthService.getReadiness(),
    (error) => error?.getStatus?.() === 503 && error?.getResponse?.().checks?.database === "down",
  );
});

test("health endpoints report a live process and a reachable PostgreSQL database", async (context) => {
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  await app.listen(0, "127.0.0.1");
  context.after(async () => {
    await app.close();
  });

  const address = app.getHttpServer().address();
  assert.notEqual(typeof address, "string");
  assert.notEqual(address, null);

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const liveResponse = await fetch(`${baseUrl}/health/live`);
  const readyResponse = await fetch(`${baseUrl}/health/ready`);

  assert.equal(liveResponse.status, 200);
  assert.deepEqual(await liveResponse.json(), {
    status: "ok",
    service: "life-inbox-api",
    checks: {
      process: "up",
    },
  });

  assert.equal(readyResponse.status, 200);
  assert.deepEqual(await readyResponse.json(), {
    status: "ok",
    service: "life-inbox-api",
    checks: {
      database: "up",
    },
  });
});
