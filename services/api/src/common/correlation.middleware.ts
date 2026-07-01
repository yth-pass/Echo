/**
 * HTTP middleware that injects a correlation ID into every request/response.
 *
 * - Generates a UUID for every inbound HTTP request.
 * - Attaches it to `req.correlationId` for downstream handlers.
 * - Sets the `X-Correlation-Id` response header so clients can trace.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { generateCorrelationId } from '../../../shared/observability';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId: string = generateCorrelationId();
    (req as unknown as Record<string, unknown>).correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);
    next();
  }
}
