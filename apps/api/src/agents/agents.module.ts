import { Module } from "@nestjs/common";

import { EventAgentService } from "./event-agent/event-agent.service";
import { eventAgentModelProvider } from "./event-agent/event-agent-model.provider";

@Module({
  providers: [eventAgentModelProvider, EventAgentService],
  exports: [EventAgentService],
})
export class AgentsModule {}
