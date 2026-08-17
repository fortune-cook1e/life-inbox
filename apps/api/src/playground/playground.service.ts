import { Injectable } from "@nestjs/common";
import { SearchAgentService } from "../agents";

@Injectable()
export class PlaygroundService {
  constructor(private readonly searchAgentService: SearchAgentService) {}

  async search(query: string) {
    return this.searchAgentService.searchQuery(query);
  }
}
