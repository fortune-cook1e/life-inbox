import { Module } from "@nestjs/common";

import { AgentModule } from "../agent/agent.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { MessageTimelineService } from "./message-timeline.service.js";
import { MessagesController } from "./messages.controller.js";

@Module({
  imports: [AgentModule, DatabaseModule],
  controllers: [MessagesController],
  providers: [MessageTimelineService],
})
export class MessagesModule {}
