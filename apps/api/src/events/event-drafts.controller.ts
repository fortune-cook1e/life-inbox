import {
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnprocessableEntityException,
} from "@nestjs/common";

import {
  toEventCancellationMessageResponse,
  toEventConfirmMessageResponse,
  toEventEditMessageResponse,
  toEventRejectMessageResponse,
} from "./event-drafts.mapper";
import { EventDraftParamsDto, UpdateEventDraftDto } from "./event-drafts.dto";
import { EventDraftsService } from "./event-drafts.service";
import type {
  EventConfirmMessageResponse,
  EventDraftRejectionResponse,
  EventEditMessageResponse,
} from "./event-drafts.types";

@Controller("event-drafts")
export class EventDraftsController {
  constructor(private readonly eventDraftsService: EventDraftsService) {}

  @Patch(":draftId")
  async editDraft(
    @Param() params: EventDraftParamsDto,
    @Body() body: UpdateEventDraftDto,
  ): Promise<EventEditMessageResponse> {
    const result = await this.eventDraftsService.editDraft(params.draftId, body);

    switch (result.kind) {
      case "edited":
        return toEventEditMessageResponse(result.eventEditMessage);
      case "invalid_draft":
        throw new UnprocessableEntityException("Event Draft values are invalid.");
      case "not_found":
        throw new NotFoundException("Event Draft not found.");
      case "status_conflict":
        throw new ConflictException(
          `Event Draft cannot be edited from status '${result.currentStatus}'.`,
        );
    }
  }

  @Post(":draftId/confirm")
  @HttpCode(HttpStatus.OK)
  async confirmDraft(@Param() params: EventDraftParamsDto): Promise<EventConfirmMessageResponse> {
    const result = await this.eventDraftsService.confirmDraft(params.draftId);

    switch (result.kind) {
      case "confirmed":
        return toEventConfirmMessageResponse(result.eventConfirmMessage);
      case "incomplete_draft":
        throw new UnprocessableEntityException(
          "Event Draft must contain a title, start time, and valid timezone.",
        );
      case "not_found":
        throw new NotFoundException("Event Draft not found.");
      case "status_conflict":
        throw new ConflictException(
          `Event Draft cannot be confirmed from status '${result.currentStatus}'.`,
        );
    }
  }

  @Post(":draftId/reject")
  @HttpCode(HttpStatus.OK)
  async rejectDraft(
    @Param() params: EventDraftParamsDto,
  ): Promise<EventDraftRejectionResponse> {
    const result = await this.eventDraftsService.rejectDraft(params.draftId);

    switch (result.kind) {
      case "rejected":
        return [
          toEventRejectMessageResponse(result.eventRejectMessage),
          toEventCancellationMessageResponse(result.cancellationMessage),
        ];
      case "not_found":
        throw new NotFoundException("Event Draft not found.");
      case "status_conflict":
        throw new ConflictException(
          `Event Draft cannot be rejected from status '${result.currentStatus}'.`,
        );
    }
  }
}
