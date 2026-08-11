import { HttpException, HttpStatus } from "@nestjs/common";
import type { ValidationError } from "class-validator";

const INVALID_REQUEST_MESSAGE = "The request is invalid.";

export class PublicApiException extends HttpException {
  constructor(
    readonly publicMessage: string,
    status: number,
  ) {
    super(publicMessage, status);
  }
}

export function createPublicValidationException(errors: ValidationError[]) {
  const messages = collectValidationMessages(errors);

  return new PublicApiException(
    messages.length > 0 ? messages.join(" ") : INVALID_REQUEST_MESSAGE,
    HttpStatus.BAD_REQUEST,
  );
}

function collectValidationMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...collectValidationMessages(error.children ?? []),
  ]);
}
