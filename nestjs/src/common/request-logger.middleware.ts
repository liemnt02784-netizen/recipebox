import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/** BE-11: middleware tự viết — log method/path/status/thời gian xử lý cho mọi request đi qua app. */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} +${durationMs}ms`);
    });
    next();
  }
}
