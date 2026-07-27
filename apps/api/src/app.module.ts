import { Module, ValidationPipe } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";

import { HealthModule } from "./health/health.module.js";
import { MessagesModule } from "./messages/messages.module.js";

@Module({
  imports: [HealthModule, MessagesModule],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    },
  ],
})
export class AppModule {}
