import { Module, ValidationPipe } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";

import { CasesModule } from "./cases/cases.module.js";
import { ApiEnvelopeInterceptor } from "./common/http/api-envelope.interceptor.js";
import { ApiExceptionFilter } from "./common/http/api-exception.filter.js";
import { createPublicValidationException } from "./common/http/public-api.exception.js";
import { HealthModule } from "./health/health.module.js";
import { MessagesModule } from "./messages/messages.module.js";
import { PlaygroundModule } from './playground/playground.module';

@Module({
  imports: [CasesModule, HealthModule, MessagesModule, PlaygroundModule],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
        exceptionFactory: createPublicValidationException,
      }),
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiEnvelopeInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule {}
