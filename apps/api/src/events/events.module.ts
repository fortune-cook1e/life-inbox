import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { EventDraftsRepository } from "./event-drafts.repository";
import { EventsService } from "./events.service";

@Module({
  imports: [DatabaseModule],
  providers: [EventDraftsRepository, EventsService],
  exports: [EventsService],
})
export class EventsModule {}
