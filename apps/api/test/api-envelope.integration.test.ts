import type { AddressInfo } from "node:net";

import {
  BadRequestException,
  Controller,
  Get,
  type INestApplication,
  ServiceUnavailableException,
} from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, expect, it } from "vitest";

import { ApiEnvelopeInterceptor } from "../src/common/http/api-envelope.interceptor.js";
import { ApiExceptionFilter } from "../src/common/http/api-exception.filter.js";
import { PublicApiException } from "../src/common/http/public-api.exception.js";
import { expectRequestId, readErrorResponse, readSuccessData } from "./api-response.helpers.js";

@Controller("test-envelope")
class EnvelopeTestController {
  @Get("success")
  getSuccess() {
    return { value: "public" };
  }

  @Get("void-success")
  getVoidSuccess() {}

  @Get("business-error")
  getBusinessError() {
    throw new PublicApiException("The submitted value is invalid.", 400);
  }

  @Get("unsafe-client-error")
  getUnsafeClientError() {
    throw new BadRequestException("database password and SQL details");
  }

  @Get("internal-error")
  getInternalError() {
    throw new Error("database password and SQL details");
  }
}

@Controller("health/test-envelope")
class HealthEnvelopeTestController {
  @Get()
  getFailure() {
    throw new ServiceUnavailableException({
      status: "error",
      service: "test",
      checks: {
        database: "down",
      },
    });
  }
}

let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [EnvelopeTestController, HealthEnvelopeTestController],
    providers: [
      {
        provide: APP_INTERCEPTOR,
        useClass: ApiEnvelopeInterceptor,
      },
      {
        provide: APP_FILTER,
        useClass: ApiExceptionFilter,
      },
    ],
  }).compile();

  app = module.createNestApplication({ logger: false });
  await app.listen(0, "127.0.0.1");

  const address = app.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await app.close();
});

it("wraps a successful JSON response", async () => {
  const response = await fetch(`${baseUrl}/test-envelope/success`);

  expect(response.status).toBe(200);
  await expect(readSuccessData(response)).resolves.toEqual({ value: "public" });
});

it("keeps data in the envelope when a successful handler returns no value", async () => {
  const response = await fetch(`${baseUrl}/test-envelope/void-success`);

  expect(response.status).toBe(200);
  await expect(readSuccessData(response)).resolves.toBeNull();
});

it("exposes an approved business-safe error message", async () => {
  const response = await fetch(`${baseUrl}/test-envelope/business-error`);
  const body = await readErrorResponse(response);

  expect(response.status).toBe(400);
  expect(body.message).toBe("The submitted value is invalid.");
});

it("hides details from an unapproved client error", async () => {
  const response = await fetch(`${baseUrl}/test-envelope/unsafe-client-error`);
  const body = await readErrorResponse(response);

  expect(response.status).toBe(400);
  expect(body.message).toBe("The request is invalid.");
  expect(JSON.stringify(body)).not.toContain("database password");
  expect(JSON.stringify(body)).not.toContain("SQL");
});

it("hides internal exception details", async () => {
  const response = await fetch(`${baseUrl}/test-envelope/internal-error`);
  const body = await readErrorResponse(response);

  expect(response.status).toBe(500);
  expect(body.message).toBe("Something went wrong. Please try again later.");
  expect(JSON.stringify(body)).not.toContain("database password");
  expect(JSON.stringify(body)).not.toContain("SQL");
});

it("keeps health probe errors outside the business envelope", async () => {
  const response = await fetch(`${baseUrl}/health/test-envelope`);

  expect(response.status).toBe(503);
  expectRequestId(response);
  await expect(response.json()).resolves.toEqual({
    status: "error",
    service: "test",
    checks: {
      database: "down",
    },
  });
});
