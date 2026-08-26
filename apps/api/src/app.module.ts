import {
  Module,
  RequestMethod,
  type MiddlewareConsumer,
  type NestModule,
} from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "nestjs-zod";

import { ApiEnvelopeInterceptor } from "./common/http/api-envelope.interceptor";
import { ApiExceptionFilter } from "./common/http/api-exception.filter";
import { RequestIdMiddleware } from "./common/http/request-id.middleware";
import { EventsModule } from "./events/events.module";
import { HealthModule } from "./health/health.module";
import { MessagesModule } from "./messages/messages.module";

@Module({
  imports: [HealthModule, EventsModule, MessagesModule],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiEnvelopeInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: "{*path}", method: RequestMethod.ALL });
  }
}
