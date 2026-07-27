import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { MessagesController } from "./messages.controller.js";
import { MessagesService } from "./messages.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
