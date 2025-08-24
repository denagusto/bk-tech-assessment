import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggingService } from '../logging.service';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly loggingService: LoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    const startTime = Date.now();

    // Generate request ID if not present
    if (!request.headers['x-request-id']) {
      request.headers['x-request-id'] = this.generateRequestId();
    }

    // Log request start
    this.loggingService.info('Request started', {
      requestId: request.headers['x-request-id'] as string,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'] as string,
      userId: request.headers['x-user-id'] as string || 'anonymous',
    });

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode || 200;

        // Log successful response
        this.loggingService.logHttpRequest(request, duration, statusCode);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode || 500;

        // Log error response
        this.loggingService.error('Request failed', {
          requestId: request.headers['x-request-id'] as string,
          method: request.method,
          url: request.url,
          ip: request.ip,
          duration,
          statusCode,
          error: error.message,
        }, error);

        throw error;
      })
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
