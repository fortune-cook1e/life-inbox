import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { MessagesController } from "./messages.controller";
import { MessagesRepository } from "./messages.repository";
import { MessagesService } from "./messages.service";

@Module({
  imports: [DatabaseModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository],
})
export class MessagesModule {}
