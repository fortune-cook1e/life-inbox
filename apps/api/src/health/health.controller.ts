import { Controller, Get } from "@nestjs/common";

import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get("live")
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get("ready")
  getReadiness() {
    return this.healthService.getReadiness();
  }
}
