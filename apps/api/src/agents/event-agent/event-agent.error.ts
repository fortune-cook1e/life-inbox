import {
  ApplicationServiceUnavailableError,
} from "../../common/errors/application-service-unavailable.error";

export class EventAgentRequestError extends ApplicationServiceUnavailableError {
  constructor(cause: unknown) {
    super("Event Agent request failed.", {
      cause,
    });
  }
}
