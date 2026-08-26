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

import {
  ApplicationServiceUnavailableError,
} from "../errors/application-service-unavailable.error";
import type { RequestWithId } from "./request-id.middleware";

interface HttpResponse {
  json(body: ApiErrorEnvelope): void;
  setHeader(name: string, value: string): void;
  status(statusCode: number): HttpResponse;
}

interface MappedException {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
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
      message: mapped.message,
    };

    const logContext = {
      event: "http_request_failed",
      requestId,
      method: request.method,
      path,
      statusCode: mapped.statusCode,
      errorCode: mapped.code,
      exceptionName: exception instanceof Error ? exception.name : "UnknownException",
    };

    if (mapped.statusCode >= 500) {
      this.logger.error(logContext);
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
        message: this.messageForStatus(HttpStatus.SERVICE_UNAVAILABLE),
      };
    }

    if (exception instanceof ZodValidationException) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: ApiErrorCode.ValidationError,
        message: "Request validation failed.",
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();

      return {
        statusCode,
        code: this.codeForStatus(statusCode),
        message: this.messageForStatus(statusCode),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ApiErrorCode.InternalError,
      message: "An unexpected error occurred.",
    };
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
