/**
 * Global exception filter — catches every unhandled exception and returns an
 * RFC 7807-style JSON error response enriched with a correlation ID.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createLogger } from '../../../shared/observability';

const logger = createLogger('api-error-filter');

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId: string =
      (request as unknown as Record<string, unknown>).correlationId as string ?? 'unknown';

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Internal server error';
    let detail: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        message =
          (exResponse as Record<string, unknown>).message as string ?? message;
      }
    } else if (exception instanceof Error) {
      detail = exception.message;
    } else {
      detail = String(exception);
    }

    logger.error('Unhandled exception', {
      correlation_id: correlationId,
      status,
      path: request.url,
      method: request.method,
      error: exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    response.status(status).json({
      code: status,
      data: null,
      message,
      ...(detail ? { detail } : {}),
      correlation_id: correlationId,
    });
  }
}
