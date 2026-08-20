import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const isHttp = exception instanceof HttpException;
    const customStatus =
      typeof exception === 'object' && exception && 'status' in exception
        ? Number(exception.status)
        : undefined;
    const status = isHttp
      ? exception.getStatus()
      : customStatus || HttpStatus.INTERNAL_SERVER_ERROR;
    if (!isHttp && status >= 500) {
      const error =
        exception instanceof Error ? exception : new Error('Unknown error');
      this.logger.error({
        event: 'request_failed',
        method: request.method,
        route: request.originalUrl?.split('?')[0],
        status,
        errorName: error.name,
        message: error.message,
      });
    }
    if (isHttp) return response.status(status).json(exception.getResponse());
    response.status(status).json({
      statusCode: status,
      message:
        status === 429
          ? 'Too many requests. Please try again shortly.'
          : 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}
