import { Injectable } from "@nestjs/common";
import { SearchAgentService } from "../agents";
import { ToolCallingAgentService } from "../agents/tool-calling-agent/tool-calling-agent.service";

@Injectable()
export class PlaygroundService {
  constructor(
    private readonly searchAgentService: SearchAgentService,
    private readonly toolCallingAgentService: ToolCallingAgentService,
  ) {}

  async search(query: string) {
    return this.searchAgentService.searchQuery(query);
  }

  async callTool(userQuery: string) {
    return this.toolCallingAgentService.executeQuery(userQuery);
  }
}
