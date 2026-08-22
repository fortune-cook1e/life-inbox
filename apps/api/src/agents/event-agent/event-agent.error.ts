export class EventAgentRequestError extends Error {
  constructor(cause: unknown) {
    super("Event Agent request failed.", {
      cause,
    });

    this.name = "EventAgentRequestError";
  }
}
