import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  type ExceptionFilter,
} from "@nestjs/common";

import { apiError } from "./api-response.js";
import { PublicApiException } from "./public-api.exception.js";
import { attachRequestId, getRequestLogContext, isHealthRequest } from "./request-context.js";

const INTERNAL_ERROR_MESSAGE = "Something went wrong. Please try again later.";
const SERVICE_UNAVAILABLE_MESSAGE =
  "The service is temporarily unavailable. Please try again later.";

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

@Catch()
@Injectable()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const httpContext = host.switchToHttp();
    const request = httpContext.getRequest<HttpRequestLike>();
    const response = httpContext.getResponse<HttpResponseLike>();
    const requestId = attachRequestId(request, response);
    const status = getHttpStatus(exception);

    if (isHealthRequest(request)) {
      this.writeHealthError(response, exception, status);
      return;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const logContext = getRequestLogContext(request);
      const trace = exception instanceof Error ? exception.stack : undefined;

      this.logger.error(
        JSON.stringify({
          event: "api_request_failed",
          requestId,
          status,
          ...logContext,
        }),
        trace,
      );
    }

    response.status(status).json(apiError(getPublicMessage(exception, status)));
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

function getHttpStatus(exception: unknown) {
  return exception instanceof HttpException
    ? exception.getStatus()
    : HttpStatus.INTERNAL_SERVER_ERROR;
}

function getPublicMessage(exception: unknown, status: number) {
  if (exception instanceof PublicApiException) {
    return exception.publicMessage;
  }

  if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
    return status === HttpStatus.SERVICE_UNAVAILABLE
      ? SERVICE_UNAVAILABLE_MESSAGE
      : INTERNAL_ERROR_MESSAGE;
  }

  return getDefaultClientErrorMessage(status);
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
      return "The request conflicts with the current resource state.";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "Too many requests. Please try again later.";
    default:
      return "The request could not be processed.";
  }
}
