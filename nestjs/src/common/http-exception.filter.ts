import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string;
  path: string;
  timestamp: string;
}

/** BE-14: exception filter tự viết — bắt MỌI lỗi (kể cả lỗi không phải HttpException, vd lỗi Mongo) và trả về format JSON thống nhất cho toàn bộ API. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.extractMessage(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = {
      statusCode: status,
      message,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }

  private extractMessage(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return payload;
      }
      const nested = (payload as { message?: string | string[] }).message;
      if (Array.isArray(nested)) {
        return nested.join(', ');
      }
      if (typeof nested === 'string') {
        return nested;
      }
      return exception.message;
    }
    // Lỗi không lường trước (vd lỗi Mongo, lỗi runtime) — không lộ message kỹ thuật ra client.
    return status === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Đã có lỗi xảy ra, vui lòng thử lại sau'
      : String(exception);
  }
}
