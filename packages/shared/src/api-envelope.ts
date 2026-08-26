export const API_SUCCESS_CODE = 0 as const;
export const API_SUCCESS_MESSAGE = "success" as const;

export enum ApiErrorCode {
  CommonError = 1000,
  ValidationError = 1001,
  Unauthorized = 1002,
  Forbidden = 1003,
  NotFound = 1004,
  Conflict = 1005,
  TooManyRequests = 1006,
  ServiceUnavailable = 1007,
  InternalError = 9000,
}

export interface ApiSuccessEnvelope<T> {
  code: typeof API_SUCCESS_CODE;
  data: T;
  message: typeof API_SUCCESS_MESSAGE;
}

export interface ApiErrorEnvelope {
  code: ApiErrorCode;
  data: null;
  message: string;
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;
