import { Module } from "@nestjs/common";

import { EventAgentService } from "./event-agent/event-agent.service";

@Module({
  providers: [EventAgentService],
  exports: [EventAgentService],
})
export class AgentsModule {}
