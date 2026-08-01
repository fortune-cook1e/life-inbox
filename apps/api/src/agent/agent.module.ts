import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { AGENT_LANGUAGE_MODEL } from "./agent.constants.js";
import { createAgentLanguageModel } from "./agent-model.provider.js";
import { AgentRunService } from "./agent-run.service.js";
import { AgentToolsService } from "./agent-tools.service.js";
import { LifeInboxAgentService } from "./life-inbox-agent.service.js";

@Module({
  imports: [DatabaseModule],
  providers: [
    AgentRunService,
    AgentToolsService,
    LifeInboxAgentService,
    {
      provide: AGENT_LANGUAGE_MODEL,
      useValue: createAgentLanguageModel,
    },
  ],
  exports: [AgentRunService],
})
export class AgentModule {}
