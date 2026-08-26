import { Injectable, type NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const requestIdSchema = z.uuid();

export interface RequestIdRequest {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  originalUrl?: string;
  requestId?: string;
  url: string;
}

export interface RequestWithId extends RequestIdRequest {
  requestId: string;
}

export interface ResponseWithRequestId {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(
    request: RequestIdRequest,
    response: ResponseWithRequestId,
    next: () => void,
  ): void {
    const suppliedRequestId = request.headers["x-request-id"];
    const requestId =
      typeof suppliedRequestId === "string" && requestIdSchema.safeParse(suppliedRequestId).success
        ? suppliedRequestId
        : randomUUID();

    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);
    next();
  }
}
