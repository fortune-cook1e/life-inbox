import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { CasesController } from "./cases.controller.js";
import { CasesService } from "./cases.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [CasesController],
  providers: [CasesService],
})
export class CasesModule {}
