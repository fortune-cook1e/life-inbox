import { Module } from "@nestjs/common";

import { EventsModule } from "../events/events.module";
import { EventAgentService } from "./event-agent/event-agent.service";
import { eventAgentModelProvider } from "./event-agent/event-agent-model.provider";

@Module({
  imports: [EventsModule],
  providers: [eventAgentModelProvider, EventAgentService],
  exports: [EventAgentService],
})
export class AgentsModule {}
