import { Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(@Inject('REQUEST_ID_FIELD') private readonly idField = 'x-request-id') {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers[this.idField] as string) ?? randomUUID();
    (req as Request & { id: string }).id = requestId;
    res.setHeader(this.idField, requestId);

    const startedAt = Date.now();
    res.on('finish', () => {
      this.logger.log(
        JSON.stringify({
          requestId,
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          durationMs: Date.now() - startedAt,
        }),
      );
    });
    next();
  }
}