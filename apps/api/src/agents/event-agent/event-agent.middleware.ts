import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { LoggerService } from "@nestjs/common";
import { createMiddleware } from "langchain";
import { z } from "zod";

import type { MessageRow } from "../../database/schemas";
import { EventAgentRequestError } from "./event-agent.error";

export const eventAgentRuntimeContextSchema = z
  .object({
    sourceMessageId: z.uuid(),
    recentMessages: z.array(z.custom<MessageRow>()),
  })
  .strict();

export function createEventAgentRuntimeMiddleware(logger: LoggerService) {
  return createMiddleware({
    name: "event-agent-runtime",
    contextSchema: eventAgentRuntimeContextSchema,

    wrapModelCall: async (request, handler) => {
      try {
        return await handler({
          ...request,
          messages: [
            ...request.runtime.context.recentMessages.map(toLangChainMessage),
            ...request.messages,
          ],
        });
      } catch (error) {
        throw new EventAgentRequestError(error);
      }
    },

    wrapToolCall: async (request, handler) => {
      const startedAt = Date.now();
      const logContext = {
        sourceMessageId: request.runtime.context.sourceMessageId,
        tool: request.toolCall.name,
        toolCallId: request.toolCall.id,
      };

      logger.log({
        event: "event_agent.tool.started",
        ...logContext,
      });

      try {
        const result = await handler(request);

        logger.log({
          event: "event_agent.tool.completed",
          ...logContext,
          durationMs: Date.now() - startedAt,
        });

        return result;
      } catch (error) {
        logger.error({
          event: "event_agent.tool.failed",
          ...logContext,
          durationMs: Date.now() - startedAt,
          errorType: error instanceof Error ? error.name : "UnknownError",
        });

        throw error;
      }
    },
  });
}

function toLangChainMessage(message: MessageRow) {
  const content =
    message.kind === "text"
      ? (message.content ?? "")
      : JSON.stringify({
          kind: message.kind,
          payload: message.payload,
        });

  return message.role === "user" ? new HumanMessage(content) : new AIMessage(content);
}
