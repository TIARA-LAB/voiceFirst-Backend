import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DomainError } from '../errors/domain-errors';

interface ErrorBody {
  statusCode: number;
  code?: string;
  message: string;
  errors?: unknown;
  path: string;
  method: string;
  requestId?: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest<{ url: string; method: string; id?: string }>();

    const body: ErrorBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      path: request.url,
      method: request.method,
      requestId: request.id,
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof DomainError) {
      body.statusCode = exception.status;
      body.code = exception.code;
      body.message = exception.message;
      if (exception.details) {
        body.errors = exception.details;
      }
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      body.statusCode = status;
      if (typeof res === 'string') {
        body.message = res;
      } else {
        const parsed = res as { message?: string | string[]; error?: string };
        body.message = Array.isArray(parsed.message) ? parsed.message.join(', ') : (parsed.message ?? exception.message);
        body.code = (res as { code?: string }).code;
        if (Array.isArray(parsed.message)) {
          body.errors = parsed.message;
        }
      }
    } else if (exception instanceof Error) {
      body.message = exception.message;
    }

    if (body.statusCode >= 500) {
      this.logger.error(
        JSON.stringify({
          ...body,
          stack: exception instanceof Error ? exception.stack : undefined,
        }),
      );
    } else {
      this.logger.warn(JSON.stringify(body));
    }

    response.status(body.statusCode).json(body);
  }
}