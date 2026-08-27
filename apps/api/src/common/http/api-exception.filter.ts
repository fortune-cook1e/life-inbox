import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ApiErrorCode, type ApiErrorEnvelope } from "@life-inbox/shared";
import { ZodValidationException } from "nestjs-zod";
import { ZodError } from "zod";

import { ApplicationServiceUnavailableError } from "../errors/application-service-unavailable.error";
import type { RequestWithId } from "./request-id.middleware";

interface HttpResponse {
  json(body: ApiErrorEnvelope): void;
  setHeader(name: string, value: string): void;
  status(statusCode: number): HttpResponse;
}

interface MappedException {
  statusCode: number;
  code: ApiErrorCode;
  publicMessage: string;
  diagnostics: Record<string, unknown>;
}

interface ErrorDiagnostic {
  name: string;
  message: string;
  code?: string | number;
  status?: string | number;
  cause?: ErrorDiagnostic;
}

@Injectable()
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<HttpResponse>();

    const requestId = request.requestId;
    const path = request.originalUrl ?? request.url;
    const mapped = this.mapException(exception);

    const body: ApiErrorEnvelope = {
      code: mapped.code,
      data: null,
      message: mapped.publicMessage,
    };

    const logContext = {
      event: "http_request_failed",
      requestId,
      method: request.method,
      path,
      statusCode: mapped.statusCode,
      errorCode: mapped.code,
      exceptionName: exception instanceof Error ? exception.name : "UnknownException",
      ...mapped.diagnostics,
    };

    if (mapped.statusCode >= 500) {
      this.logger.error(
        logContext,
        this.findRootError(exception)?.stack,
      );
    } else {
      this.logger.warn(logContext);
    }

    response.setHeader("x-request-id", requestId);
    response.status(mapped.statusCode).json(body);
  }

  private mapException(exception: unknown): MappedException {
    if (exception instanceof ApplicationServiceUnavailableError) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: ApiErrorCode.ServiceUnavailable,
        publicMessage: exception.publicMessage,
        diagnostics: {
          error: this.toErrorDiagnostic(exception),
        },
      };
    }

    if (exception instanceof ZodValidationException) {
      return this.mapValidationException(exception);
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();

      return {
        statusCode,
        code: this.codeForStatus(statusCode),
        publicMessage: this.publicMessageForHttpException(exception),
        diagnostics: {
          error: this.toErrorDiagnostic(exception),
        },
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ApiErrorCode.InternalError,
      publicMessage: "An unexpected error occurred.",
      diagnostics: {
        error:
          exception instanceof Error
            ? this.toErrorDiagnostic(exception)
            : {
                name: "NonErrorThrownValue",
                message: "A non-Error value was thrown.",
              },
      },
    };
  }

  private toErrorDiagnostic(error: Error, depth = 0): ErrorDiagnostic {
    const errorRecord = error as Error & {
      code?: unknown;
      status?: unknown;
    };

    const diagnostic: ErrorDiagnostic = {
      name: error.name,
      message: error.message,
    };

    if (typeof errorRecord.code === "string" || typeof errorRecord.code === "number") {
      diagnostic.code = errorRecord.code;
    }

    if (typeof errorRecord.status === "string" || typeof errorRecord.status === "number") {
      diagnostic.status = errorRecord.status;
    }

    if (depth < 4 && error.cause instanceof Error) {
      diagnostic.cause = this.toErrorDiagnostic(error.cause, depth + 1);
    }

    return diagnostic;
  }

  private findRootError(error: unknown): Error | undefined {
    if (!(error instanceof Error)) {
      return undefined;
    }

    let root = error;
    let depth = 0;

    while (depth < 4 && root.cause instanceof Error) {
      root = root.cause;
      depth += 1;
    }

    return root;
  }

  private mapValidationException(
    exception: ZodValidationException,
  ): MappedException {
    const error = exception.getZodError();

    if (!(error instanceof ZodError)) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: ApiErrorCode.ValidationError,
        publicMessage: "Request validation failed.",
        diagnostics: {
          validationErrorAvailable: false,
        },
      };
    }

    const validationIssues = error.issues.map((issue) => ({
      code: issue.code,
      path: issue.path.map(String),
      message: issue.message,
    }));

    return {
      statusCode: HttpStatus.BAD_REQUEST,
      code: ApiErrorCode.ValidationError,
      publicMessage: error.issues[0]?.message ?? "Request validation failed.",
      diagnostics: {
        validationIssues,
      },
    };
  }

  private publicMessageForHttpException(exception: HttpException): string {
    const statusCode = exception.getStatus();

    if (statusCode >= 500) {
      return this.messageForStatus(statusCode);
    }

    const response = exception.getResponse();

    if (typeof response === "string" && response.trim().length > 0) {
      return response;
    }

    if (typeof response === "object" && response !== null && "message" in response) {
      const message = response.message;

      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }

      if (Array.isArray(message)) {
        const messages = message.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        );

        if (messages.length > 0) {
          return messages.join("; ");
        }
      }
    }

    return this.messageForStatus(statusCode);
  }

  private codeForStatus(statusCode: number): ApiErrorCode {
    switch (statusCode) {
      case HttpStatus.UNAUTHORIZED:
        return ApiErrorCode.Unauthorized;
      case HttpStatus.FORBIDDEN:
        return ApiErrorCode.Forbidden;
      case HttpStatus.NOT_FOUND:
        return ApiErrorCode.NotFound;
      case HttpStatus.CONFLICT:
        return ApiErrorCode.Conflict;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ApiErrorCode.ValidationError;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ApiErrorCode.TooManyRequests;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ApiErrorCode.ServiceUnavailable;
      default:
        return statusCode >= 500 ? ApiErrorCode.InternalError : ApiErrorCode.CommonError;
    }
  }

  private messageForStatus(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.UNAUTHORIZED:
        return "Authentication is required.";
      case HttpStatus.FORBIDDEN:
        return "You are not allowed to perform this action.";
      case HttpStatus.NOT_FOUND:
        return "The requested resource was not found.";
      case HttpStatus.CONFLICT:
        return "The request conflicts with the current resource state.";
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return "Request validation failed.";
      case HttpStatus.SERVICE_UNAVAILABLE:
        return "The service is temporarily unavailable.";
      default:
        return statusCode >= 500
          ? "An unexpected error occurred."
          : "The request could not be processed.";
    }
  }
}
