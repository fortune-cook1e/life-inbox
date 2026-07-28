import { BadRequestException } from "@nestjs/common";

interface MessageCursorSource {
  id: string;
  createdAt: Date;
}

export interface MessageCursor {
  id: string;
  createdAt: Date;
}

export function encodeMessageCursor(message: MessageCursorSource) {
  return Buffer.from(
    JSON.stringify({
      id: message.id,
      createdAt: message.createdAt.toISOString(),
    }),
  ).toString("base64url");
}

export function decodeMessageCursor(cursor: string): MessageCursor {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));

    if (!isCursorValue(value)) {
      throw new Error("Invalid cursor value.");
    }

    const createdAt = new Date(value.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      throw new Error("Invalid cursor timestamp.");
    }

    return {
      id: value.id,
      createdAt,
    };
  } catch {
    throw new BadRequestException("Invalid message cursor.");
  }
}

function isCursorValue(value: unknown): value is { id: string; createdAt: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    isUuid(value.id) &&
    "createdAt" in value &&
    typeof value.createdAt === "string"
  );
}

function isUuid(value: string) {
  return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
}
