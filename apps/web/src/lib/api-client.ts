import axios, { AxiosError, type AxiosResponse } from "axios";

export interface ApiSuccessEnvelope<T> {
  code: 0;
  message: "";
  data: T;
}

export interface ApiErrorEnvelope {
  code: 2;
  message: string;
  data: null;
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

const DEFAULT_TIMEOUT_MS = 20_000;

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly apiCode: 2 | undefined,
    public readonly details: unknown,
    public readonly requestId: string | undefined,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export const apiClient = axios.create({
  baseURL: "/api",
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    Accept: "application/json",
  },
  transitional: {
    clarifyTimeoutError: true,
  },
});

apiClient.interceptors.response.use(
  (response: AxiosResponse<unknown>) => {
    const envelope = response.data;

    if (!isApiSuccessEnvelope(envelope)) {
      throw new ApiClientError(
        response.status,
        "LifeInbox returned an invalid success response.",
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
  if (!axios.isAxiosError(error)) {
    return error;
  }

  if (axios.isCancel(error)) {
    return new DOMException("The request was cancelled.", "AbortError");
  }

  if (isTimeoutError(error)) {
    return new ApiClientError(
      408,
      "LifeInbox took too long to respond. Reload the conversation before trying again.",
      undefined,
      null,
      getRequestId(error.response),
    );
  }

  const response = error.response;

  if (!response) {
    return new ApiClientError(0, "LifeInbox could not reach the API.", undefined, null, undefined);
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
    "LifeInbox returned an invalid error response.",
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
    value.code === 0 &&
    value.message === "" &&
    Object.prototype.hasOwnProperty.call(value, "data")
  );
}

function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  return (
    isRecord(value) && value.code === 2 && typeof value.message === "string" && value.data === null
  );
}

function getRequestId(response: AxiosResponse | undefined) {
  const requestId = response?.headers["x-request-id"];
  return typeof requestId === "string" ? requestId : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
