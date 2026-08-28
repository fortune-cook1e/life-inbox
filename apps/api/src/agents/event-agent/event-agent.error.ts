import { MiddlewareError } from "langchain";

import {
  ApplicationServiceUnavailableError,
} from "../../common/errors/application-service-unavailable.error";

export class EventAgentRequestError extends ApplicationServiceUnavailableError {
  constructor(cause: unknown) {
    super("Event Agent request failed.", {
      cause: unwrapMiddlewareError(cause),
      publicMessage:
        "The Event assistant could not process your message. Please try again.",
    });
  }
}

export function unwrapMiddlewareError(error: unknown): unknown {
  let currentError = error;
  const visitedErrors = new Set<Error>();

  while (
    MiddlewareError.isInstance(currentError) &&
    currentError.cause !== undefined &&
    !visitedErrors.has(currentError)
  ) {
    visitedErrors.add(currentError);
    currentError = currentError.cause;
  }

  return currentError;
}
