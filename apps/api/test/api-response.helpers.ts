import { expect } from "vitest";

import type { ApiErrorResponse, ApiSuccessResponse } from "../src/common/http/api-response.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function readSuccessData<T>(response: Response) {
  expectRequestId(response);

  const body = (await response.json()) as ApiSuccessResponse<T>;

  expect(body.code).toBe(0);
  expect(body.message).toBe("");
  expect(body).toHaveProperty("data");
  expect(Object.keys(body).sort()).toEqual(["code", "data", "message"]);

  return body.data;
}

export async function readErrorResponse(response: Response) {
  expectRequestId(response);

  const body = (await response.json()) as ApiErrorResponse;

  expect(body).toEqual({
    code: 2,
    message: expect.any(String),
    data: null,
  });

  return body;
}

export function expectRequestId(response: Response) {
  expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
}
