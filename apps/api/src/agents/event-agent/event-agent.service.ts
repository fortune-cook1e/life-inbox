import { HumanMessage } from "@langchain/core/messages";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  createAgent,
  modelCallLimitMiddleware,
  tool,
  toolCallLimitMiddleware,
  toolErrorMiddleware,
} from "langchain";
import { z } from "zod";

import type { EventDraftRow } from "../../database/schemas";
import { EventDraftsService } from "../../events/event-drafts.service";
import type { IncompletePendingEventDraftContext } from "../../events/event-drafts.types";
import {
  EventAgentRequestError,
  unwrapMiddlewareError,
} from "./event-agent.error";
import {
  createEventAgentRuntimeMiddleware,
  eventAgentRuntimeContextSchema,
} from "./event-agent.middleware";
import { EVENT_AGENT_MODEL, type EventAgentModel } from "./event-agent-model.provider";
import { buildEventAgentSystemPrompt } from "./event-agent.prompt";
import {
  createEventDraftToolInputSchema,
  eventAgentResponseSchema,
  eventAgentRunInputSchema,
  updateEventDraftToolInputSchema,
  type EventAgentDraftMutation,
  type EventAgentRunInput,
  type EventAgentRunResult,
} from "./event-agent.types";

const MAX_MODEL_CALLS = 3;
const MAX_TOOL_CALLS = 3;

@Injectable()
export class EventAgentService {
  private readonly logger = new Logger(EventAgentService.name);

  constructor(
    @Inject(EVENT_AGENT_MODEL) private readonly model: EventAgentModel,
    private readonly eventDraftsService: EventDraftsService,
  ) {}

  async run(input: EventAgentRunInput): Promise<EventAgentRunResult> {
    const validatedInput = eventAgentRunInputSchema.parse(input);
    const pendingDrafts = await this.eventDraftsService.findIncompletePendingDraftContexts();
    const allowedDraftIds = new Set(pendingDrafts.map(({ draft }) => draft.id));

    // Track whether a Draft mutation has been used in this Agent run,
    //  and if so, which mutation was used.
    //  This is to enforce the rule that only one Draft mutation can be used per Agent run.
    const runState: {
      mutationUsed: boolean;
      mutation: EventAgentDraftMutation | null;
    } = {
      mutationUsed: false,
      mutation: null,
    };

    const findIncompleteDrafts = tool(
      async () => JSON.stringify(this.toToolDraftContexts(pendingDrafts)),
      {
        name: "find_incomplete_event_drafts",
        description:
          "List incomplete pending Event Drafts and their source messages before resolving a clarification reply.",
        schema: z.object({}).strict(),
      },
    );

    const createEventDraft = tool(
      async (event) => {
        if (runState.mutationUsed) {
          return JSON.stringify({
            ok: false,
            error: "This Agent run already used its single Draft mutation.",
          });
        }

        runState.mutationUsed = true;

        const result = await this.eventDraftsService.createPendingDraftWithInitialCard({
          sourceMessageId: validatedInput.sourceMessageId,
          defaultTimezone: validatedInput.userTimezone,
          event,
        });

        runState.mutation = result;

        return JSON.stringify({
          ok: true,
          draft: this.toToolDraft(result.draft),
          missingFields: this.findMissingRequiredFields(result.draft),
        });
      },
      {
        name: "create_event_draft",
        description:
          "Create one pending Event Draft for a new Event request. The backend supplies the source message and default timezone.",
        schema: createEventDraftToolInputSchema,
      },
    );

    const updateEventDraft = tool(
      async ({ draftId, changes }) => {
        if (runState.mutationUsed) {
          return JSON.stringify({
            ok: false,
            error: "This Agent run already used its single Draft mutation.",
          });
        }

        runState.mutationUsed = true;

        if (!allowedDraftIds.has(draftId)) {
          return JSON.stringify({
            ok: false,
            error: "The Draft is not an incomplete pending candidate for this Agent run.",
          });
        }

        const result = await this.eventDraftsService.updatePendingDraftFromAgent(draftId, changes);

        if (result.kind !== "updated") {
          return JSON.stringify({ ok: false, error: result.kind });
        }

        runState.mutation = result;

        return JSON.stringify({
          ok: true,
          draft: this.toToolDraft(result.draft),
          missingFields: this.findMissingRequiredFields(result.draft),
        });
      },
      {
        name: "update_event_draft",
        description:
          "Update one incomplete pending Event Draft when the supplied conversation context identifies it unambiguously.",
        schema: updateEventDraftToolInputSchema,
      },
    );

    try {
      const agent = createAgent({
        model: this.model,
        tools: [findIncompleteDrafts, createEventDraft, updateEventDraft],
        systemPrompt: buildEventAgentSystemPrompt(validatedInput),
        responseFormat: eventAgentResponseSchema,
        contextSchema: eventAgentRuntimeContextSchema,
        middleware: [
          createEventAgentRuntimeMiddleware(this.logger),
          toolErrorMiddleware({
            onError: () => undefined,
          }),
          modelCallLimitMiddleware({
            runLimit: MAX_MODEL_CALLS,
            exitBehavior: "error",
          }),
          toolCallLimitMiddleware({
            runLimit: MAX_TOOL_CALLS,
            exitBehavior: "error",
          }),
        ],
      });

      const result = await agent.invoke(
        {
          messages: [new HumanMessage(validatedInput.content)],
        },
        {
          context: {
            sourceMessageId: validatedInput.sourceMessageId,
            recentMessages: validatedInput.history,
          },
        },
      );

      const response = result.structuredResponse.message.trim();

      if (runState.mutation !== null) {
        return this.toMutationResult(runState.mutation, response);
      }

      return {
        kind: "text",
        response,
      };
    } catch (error) {
      const unwrappedError = unwrapMiddlewareError(error);

      if (runState.mutation !== null) {
        this.logger.error({
          event: "event_agent.post_mutation_fallback",
          sourceMessageId: validatedInput.sourceMessageId,
          draftId: runState.mutation.draft.id,
          errorType:
            unwrappedError instanceof Error ? unwrappedError.name : "UnknownError",
        });

        return this.toMutationResult(runState.mutation, "");
      }

      if (unwrappedError instanceof EventAgentRequestError) {
        throw unwrappedError;
      }

      throw unwrappedError;
    }
  }

  private toMutationResult(
    mutation: EventAgentDraftMutation,
    response: string,
  ): EventAgentRunResult {
    const missingFields = this.findMissingRequiredFields(mutation.draft);

    return {
      kind: "event_card",
      eventCardMessage: mutation.eventCardMessage,
      clarification:
        missingFields.length > 0
          ? response || this.buildDeterministicClarification(missingFields[0])
          : null,
    };
  }

  private buildDeterministicClarification(
    missingField: "title" | "startAt" | undefined,
  ): string {
    switch (missingField) {
      case "title":
        return "What is this Event about?";
      case "startAt":
        return "What time should this Event start?";
      default:
        return "What information is missing from this Event?";
    }
  }

  private toToolDraftContexts(contexts: IncompletePendingEventDraftContext[]) {
    return contexts.map(({ draft, sourceMessageContent }) => ({
      ...this.toToolDraft(draft),
      sourceMessageContent,
    }));
  }

  private toToolDraft(draft: EventDraftRow) {
    return {
      draftId: draft.id,
      title: draft.title,
      startAt: draft.startAt,
      endAt: draft.endAt,
      timezone: draft.timezone,
      location: draft.location,
      description: draft.description,
    };
  }

  private findMissingRequiredFields(draft: EventDraftRow): Array<"title" | "startAt"> {
    const missingFields: Array<"title" | "startAt"> = [];

    if (draft.title === null || draft.title.trim().length === 0) {
      missingFields.push("title");
    }

    if (draft.startAt === null) {
      missingFields.push("startAt");
    }

    return missingFields;
  }
}
