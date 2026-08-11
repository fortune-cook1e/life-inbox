import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  type ExceptionFilter,
} from "@nestjs/common";
import { DatabaseError } from "pg";

import { apiError } from "./api-response.js";
import { PublicApiException } from "./public-api.exception.js";
import { attachRequestId, getRequestLogContext, isHealthRequest } from "./request-context.js";

const INTERNAL_ERROR_MESSAGE = "Something went wrong. Please try again later.";
const SERVICE_UNAVAILABLE_MESSAGE =
  "The service is temporarily unavailable. Please try again later.";
const CONFLICT_MESSAGE = "The request conflicts with the current resource state.";
const POSTGRES_CONFLICT_CODES = new Set(["23503", "23505"]);
const POSTGRES_RETRYABLE_CODES = new Set([
  "40001",
  "40P01",
  "53300",
  "55P03",
  "57014",
  "57P01",
  "57P02",
  "57P03",
]);
const TRANSIENT_SYSTEM_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
]);

interface HttpResponseLike {
  setHeader(name: string, value: string): void;
  status(statusCode: number): HttpResponseLike;
  json(body: unknown): void;
}

interface HttpRequestLike {
  method?: string;
  originalUrl?: string;
  path?: string;
  url?: string;
}

interface ResolvedApiError {
  status: number;
  publicMessage: string;
  category: "business" | "database_conflict" | "dependency_unavailable" | "http" | "unexpected";
  logLevel: "none" | "warn" | "error";
  databaseCode?: string;
  constraint?: string;
}

@Catch()
@Injectable()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const httpContext = host.switchToHttp();
    const request = httpContext.getRequest<HttpRequestLike>();
    const response = httpContext.getResponse<HttpResponseLike>();
    const requestId = attachRequestId(request, response);
    const resolvedError = resolveApiError(exception);

    if (isHealthRequest(request)) {
      this.writeHealthError(response, exception, resolvedError.status);
      return;
    }

    this.logError(exception, request, requestId, resolvedError);

    response.status(resolvedError.status).json(apiError(resolvedError.publicMessage));
  }

  private logError(
    exception: unknown,
    request: HttpRequestLike,
    requestId: string,
    resolvedError: ResolvedApiError,
  ) {
    if (resolvedError.logLevel === "none") {
      return;
    }

    const message = JSON.stringify({
      event: "api_request_failed",
      requestId,
      status: resolvedError.status,
      category: resolvedError.category,
      databaseCode: resolvedError.databaseCode,
      constraint: resolvedError.constraint,
      ...getRequestLogContext(request),
    });

    if (resolvedError.logLevel === "warn") {
      this.logger.warn(message);
      return;
    }

    const canLogStack =
      !resolvedError.databaseCode && resolvedError.category !== "dependency_unavailable";

    if (canLogStack && exception instanceof Error) {
      this.logger.error(message, exception.stack);
      return;
    }

    this.logger.error(message);
  }

  private writeHealthError(response: HttpResponseLike, exception: unknown, status: number) {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      response.status(status).json(
        typeof exceptionResponse === "string"
          ? {
              statusCode: status,
              message: exceptionResponse,
            }
          : exceptionResponse,
      );
      return;
    }

    response.status(status).json({
      statusCode: status,
      message: "Internal server error",
    });
  }
}

function resolveApiError(exception: unknown): ResolvedApiError {
  if (exception instanceof PublicApiException) {
    const status = exception.getStatus();

    return {
      status,
      publicMessage: exception.publicMessage,
      category: "business",
      logLevel: status >= HttpStatus.INTERNAL_SERVER_ERROR ? "error" : "none",
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();

    return {
      status,
      publicMessage:
        status === HttpStatus.SERVICE_UNAVAILABLE
          ? SERVICE_UNAVAILABLE_MESSAGE
          : status >= HttpStatus.INTERNAL_SERVER_ERROR
            ? INTERNAL_ERROR_MESSAGE
            : getDefaultClientErrorMessage(status),
      category: "http",
      logLevel: status >= HttpStatus.INTERNAL_SERVER_ERROR ? "error" : "none",
    };
  }

  const databaseError = findDatabaseError(exception);

  if (databaseError) {
    return resolveDatabaseError(databaseError);
  }

  if (findTransientSystemErrorCode(exception)) {
    return {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      publicMessage: SERVICE_UNAVAILABLE_MESSAGE,
      category: "dependency_unavailable",
      logLevel: "error",
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    publicMessage: INTERNAL_ERROR_MESSAGE,
    category: "unexpected",
    logLevel: "error",
  };
}

function resolveDatabaseError(error: DatabaseError): ResolvedApiError {
  const code = error.code;
  const metadata = {
    databaseCode: code,
    constraint: error.constraint,
  };

  if (code && POSTGRES_CONFLICT_CODES.has(code)) {
    return {
      status: HttpStatus.CONFLICT,
      publicMessage: CONFLICT_MESSAGE,
      category: "database_conflict",
      logLevel: "warn",
      ...metadata,
    };
  }

  if (code && (code.startsWith("08") || POSTGRES_RETRYABLE_CODES.has(code))) {
    return {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      publicMessage: SERVICE_UNAVAILABLE_MESSAGE,
      category: "dependency_unavailable",
      logLevel: "error",
      ...metadata,
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    publicMessage: INTERNAL_ERROR_MESSAGE,
    category: "unexpected",
    logLevel: "error",
    ...metadata,
  };
}

function getDefaultClientErrorMessage(status: number) {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return "The request is invalid.";
    case HttpStatus.UNAUTHORIZED:
      return "Authentication is required.";
    case HttpStatus.FORBIDDEN:
      return "You do not have permission to perform this action.";
    case HttpStatus.NOT_FOUND:
      return "The requested resource was not found.";
    case HttpStatus.CONFLICT:
      return CONFLICT_MESSAGE;
    case HttpStatus.TOO_MANY_REQUESTS:
      return "Too many requests. Please try again later.";
    default:
      return "The request could not be processed.";
  }
}

function findDatabaseError(error: unknown, depth = 0): DatabaseError | null {
  if (error instanceof DatabaseError) {
    return error;
  }

  if (depth >= 4 || typeof error !== "object" || error === null) {
    return null;
  }

  if (error instanceof AggregateError) {
    for (const nestedError of error.errors) {
      const databaseError = findDatabaseError(nestedError, depth + 1);

      if (databaseError) {
        return databaseError;
      }
    }
  }

  return "cause" in error ? findDatabaseError(error.cause, depth + 1) : null;
}

function findTransientSystemErrorCode(error: unknown, depth = 0): string | null {
  if (depth >= 4 || typeof error !== "object" || error === null) {
    return null;
  }

  if (
    "code" in error &&
    typeof error.code === "string" &&
    TRANSIENT_SYSTEM_ERROR_CODES.has(error.code)
  ) {
    return error.code;
  }

  if (error instanceof AggregateError) {
    for (const nestedError of error.errors) {
      const code = findTransientSystemErrorCode(nestedError, depth + 1);

      if (code) {
        return code;
      }
    }
  }

  return "cause" in error ? findTransientSystemErrorCode(error.cause, depth + 1) : null;
}
