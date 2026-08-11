export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ApiSuccessResponse<T> {
  code: 0;
  message: "";
  data: T;
}

export interface ApiErrorResponse {
  code: 2;
  message: string;
  data: null;
}

export function apiSuccess<T>(data: T): ApiSuccessResponse<T> {
  return {
    code: 0,
    message: "",
    data,
  };
}

export function apiError(message: string): ApiErrorResponse {
  return {
    code: 2,
    message,
    data: null,
  };
}
