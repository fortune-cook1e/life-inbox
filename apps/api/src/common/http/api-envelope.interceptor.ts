import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { map, type Observable } from "rxjs";

import { apiSuccess } from "./api-response.js";
import { attachRequestId, isHealthRequest } from "./request-context.js";

interface HttpResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
}

@Injectable()
export class ApiEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<object>();
    const response = httpContext.getResponse<HttpResponseLike>();

    attachRequestId(request, response);

    if (isHealthRequest(request)) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => {
        if (response.statusCode === 204) {
          return data;
        }

        return apiSuccess(data ?? null);
      }),
    );
  }
}
