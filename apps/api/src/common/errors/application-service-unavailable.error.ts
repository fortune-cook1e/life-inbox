interface ApplicationServiceUnavailableErrorOptions extends ErrorOptions {
  publicMessage: string;
}

export class ApplicationServiceUnavailableError extends Error {
  readonly publicMessage: string;

  constructor(message: string, options: ApplicationServiceUnavailableErrorOptions) {
    const { publicMessage, ...errorOptions } = options;

    super(message, errorOptions);
    this.name = new.target.name;
    this.publicMessage = publicMessage;
  }
}
