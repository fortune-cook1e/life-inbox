import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { HealthModule } from "./health/health.module";
import { ZodValidationPipe } from "nestjs-zod";
import { MessagesModule } from "./messages/messages.module";

@Module({
  imports: [HealthModule, MessagesModule],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
