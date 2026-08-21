import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Controller("health")
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}
  @Get()
  checkHealth(): { status: string } {
    return { status: "ok" };
  }

  @Get("database")
  async checkDatabase(): Promise<{
    status: "ok";
    database: "connected";
  }> {
    try {
      await this.databaseService.ping();

      return {
        status: "ok",
        database: "connected",
      };
    } catch {
      throw new ServiceUnavailableException({
        status: "unavailable",
        database: "disconnected",
      });
    }
  }
}
