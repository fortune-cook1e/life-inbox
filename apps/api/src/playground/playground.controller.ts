import { Body, Controller, Get, Post } from "@nestjs/common";
import { PlaygroundService } from "./playground.service";
import { SearchQueryDto } from "./playground.dto";

@Controller("playground")
export class PlaygroundController {
  constructor(private readonly playgroundService: PlaygroundService) {}

  @Post("/search")
  async searchQuery(@Body() input: SearchQueryDto) {
    return await this.playgroundService.search(input.query);
  }

  @Post("/tool-call")
  async toolCall(@Body() input: { query: string }) {
    const response = await this.playgroundService.callTool(input.query);
    return response;
  }
}
