import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { EventDraftAgentRepository } from "./event-draft-agent.repository";
import { EventDraftIntakeRepository } from "./event-draft-intake.repository";
import { EventDraftTransitionsRepository } from "./event-draft-transitions.repository";
import { EventDraftsController } from "./event-drafts.controller";
import { EventDraftsService } from "./event-drafts.service";

@Module({
  imports: [DatabaseModule],
  controllers: [EventDraftsController],
  providers: [
    EventDraftAgentRepository,
    EventDraftIntakeRepository,
    EventDraftTransitionsRepository,
    EventDraftsService,
  ],
  exports: [EventDraftsService],
})
export class EventsModule {}
