import type { AddressInfo } from "node:net";

import { type INestApplication, ServiceUnavailableException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "../src/app.module.js";
import { DatabaseService } from "../src/database/database.service.js";
import { HealthService } from "../src/health/health.service.js";

describe("HealthService", () => {
  it("does not query the database for liveness", () => {
    const ping = vi.fn<DatabaseService["ping"]>();
    const healthService = new HealthService(createDatabaseServiceMock(ping));

    expect(healthService.getLiveness()).toEqual({
      status: "ok",
      service: "life-inbox-api",
      checks: {
        process: "up",
      },
    });
    expect(ping).not.toHaveBeenCalled();
  });

  it("converts a database failure into service unavailable", async () => {
    const healthService = new HealthService(
      createDatabaseServiceMock(
        vi.fn<DatabaseService["ping"]>().mockRejectedValue(new Error("database unavailable")),
      ),
    );

    try {
      await healthService.getReadiness();
      expect.fail("readiness should fail when the database is unavailable");
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getStatus()).toBe(503);
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
        checks: {
          database: "down",
        },
      });
    }
  });
});

function createDatabaseServiceMock(ping: DatabaseService["ping"]) {
  const databaseService = Object.create(DatabaseService.prototype) as DatabaseService;
  databaseService.ping = ping;

  return databaseService;
}

describe("health endpoints", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, {
      logger: false,
    });
    await app.listen(0, "127.0.0.1");

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports a live process and a reachable PostgreSQL database", async () => {
    const liveResponse = await fetch(`${baseUrl}/health/live`);
    const readyResponse = await fetch(`${baseUrl}/health/ready`);

    expect(liveResponse.status).toBe(200);
    await expect(liveResponse.json()).resolves.toEqual({
      status: "ok",
      service: "life-inbox-api",
      checks: {
        process: "up",
      },
    });

    expect(readyResponse.status).toBe(200);
    await expect(readyResponse.json()).resolves.toEqual({
      status: "ok",
      service: "life-inbox-api",
      checks: {
        database: "up",
      },
    });
  });
});
