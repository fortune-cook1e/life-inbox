import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { EventDraftsRepository } from "./event-drafts.repository";
import { EventIntakeRepository } from "./event-intake.repository";
import { EventsService } from "./events.service";

@Module({
  imports: [DatabaseModule],
  providers: [EventDraftsRepository, EventIntakeRepository, EventsService],
  exports: [EventsService],
})
export class EventsModule {}
