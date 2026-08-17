import { Module } from "@nestjs/common";
import { PlaygroundService } from "./playground.service";
import { PlaygroundController } from "./playground.controller";
import { SearchAgentService } from "../agents";

@Module({
  controllers: [PlaygroundController],
  providers: [PlaygroundService, SearchAgentService],
})
export class PlaygroundModule {}
