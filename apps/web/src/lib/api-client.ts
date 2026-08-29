import {
  API_SUCCESS_CODE,
  API_SUCCESS_MESSAGE,
  type ApiErrorCode,
  type ApiErrorEnvelope,
  type ApiSuccessEnvelope,
} from "@life-inbox/shared";
import axios, { AxiosError, type AxiosResponse } from "axios";

const DEFAULT_TIMEOUT_MS = 20_000;

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly apiCode: ApiErrorCode | undefined,
    public readonly details: unknown,
    public readonly requestId: string | undefined,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api",
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { Accept: "application/json" },
  transitional: { clarifyTimeoutError: true },
});

apiClient.interceptors.response.use(
  (response: AxiosResponse<unknown>) => {
    const envelope = response.data;

    if (!isApiSuccessEnvelope(envelope)) {
      throw new ApiClientError(
        response.status,
        "The API returned an invalid success response.",
        undefined,
        envelope,
        getRequestId(response),
      );
    }

    response.data = envelope.data;
    return response;
  },
  (error: unknown) => Promise.reject(normalizeAxiosError(error)),
);

function normalizeAxiosError(error: unknown): unknown {
  if (!axios.isAxiosError(error)) return error;
  if (axios.isCancel(error)) return new DOMException("The request was cancelled.", "AbortError");

  if (isTimeoutError(error)) {
    return new ApiClientError(
      408,
      "The request took too long to complete. Reload the conversation before trying again.",
      undefined,
      null,
      getRequestId(error.response),
    );
  }

  const response = error.response;
  if (!response) {
    return new ApiClientError(0, "The API could not be reached.", undefined, null, undefined);
  }

  const envelope = response.data;
  if (isApiErrorEnvelope(envelope)) {
    return new ApiClientError(
      response.status,
      envelope.message,
      envelope.code,
      envelope,
      getRequestId(response),
    );
  }

  return new ApiClientError(
    response.status,
    "The API returned an invalid error response.",
    undefined,
    envelope,
    getRequestId(response),
  );
}

function isTimeoutError(error: AxiosError) {
  return error.code === AxiosError.ETIMEDOUT || error.code === AxiosError.ECONNABORTED;
}

function isApiSuccessEnvelope(value: unknown): value is ApiSuccessEnvelope<unknown> {
  return (
    isRecord(value) &&
    value.code === API_SUCCESS_CODE &&
    value.message === API_SUCCESS_MESSAGE &&
    Object.prototype.hasOwnProperty.call(value, "data")
  );
}

function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  return (
    isRecord(value) &&
    typeof value.code === "number" &&
    value.code !== API_SUCCESS_CODE &&
    typeof value.message === "string" &&
    value.data === null
  );
}

function getRequestId(response: AxiosResponse | undefined) {
  const requestId = response?.headers["x-request-id"];
  return typeof requestId === "string" ? requestId : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
