import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import {
  API_SUCCESS_CODE,
  API_SUCCESS_MESSAGE,
  type ApiSuccessEnvelope,
} from "@life-inbox/shared";
import { map, type Observable } from "rxjs";

@Injectable()
export class ApiEnvelopeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessEnvelope<unknown>> {
    return next.handle().pipe(
      map((data: unknown) => ({
        code: API_SUCCESS_CODE,
        data,
        message: API_SUCCESS_MESSAGE,
      })),
    );
  }
}
