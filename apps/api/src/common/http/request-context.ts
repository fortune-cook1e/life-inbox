import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "X-Request-Id";

interface HeaderResponse {
  setHeader(name: string, value: string): void;
}

interface HttpRequestLike {
  method?: string;
  originalUrl?: string;
  path?: string;
  url?: string;
}

const requestIds = new WeakMap<object, string>();

export function attachRequestId(request: object, response: HeaderResponse) {
  const existingRequestId = requestIds.get(request);
  const requestId = existingRequestId ?? randomUUID();

  if (!existingRequestId) {
    requestIds.set(request, requestId);
  }

  response.setHeader(REQUEST_ID_HEADER, requestId);

  return requestId;
}

export function isHealthRequest(request: HttpRequestLike) {
  const path = request.path ?? request.originalUrl ?? request.url ?? "";
  const pathWithoutQuery = path.split("?", 1)[0] ?? "";

  return pathWithoutQuery === "/health" || pathWithoutQuery.startsWith("/health/");
}

export function getRequestLogContext(request: HttpRequestLike) {
  const path = request.path ?? request.originalUrl ?? request.url ?? "unknown";

  return {
    method: request.method ?? "unknown",
    path: path.split("?", 1)[0] ?? "unknown",
  };
}
