import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";

const serviceName = "life-inbox-api";

@Injectable()
export class HealthService {
  constructor(private readonly databaseService: DatabaseService) {}

  getLiveness() {
    return {
      status: "ok",
      service: serviceName,
      checks: {
        process: "up",
      },
    };
  }

  async getReadiness() {
    try {
      await this.databaseService.ping();

      return {
        status: "ok",
        service: serviceName,
        checks: {
          database: "up",
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: "error",
        service: serviceName,
        checks: {
          database: "down",
        },
      });
    }
  }
}
