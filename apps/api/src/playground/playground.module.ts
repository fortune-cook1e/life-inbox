import { Module } from "@nestjs/common";
import { PlaygroundService } from "./playground.service";
import { PlaygroundController } from "./playground.controller";
import { SearchAgentService } from "../agents";
import { ToolCallingAgentService } from "../agents/tool-calling-agent/tool-calling-agent.service";

@Module({
  controllers: [PlaygroundController],
  providers: [PlaygroundService, SearchAgentService, ToolCallingAgentService],
})
export class PlaygroundModule {}
