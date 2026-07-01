/**
 * Rate-limit guard for the LLM proxy endpoint.
 *
 * Uses an in-memory token-bucket per user (falling back to IP when
 * unauthenticated).  Default: 20 requests per 60-second window.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { createLogger, incrementCounter } from '../../../shared/observability';

const logger = createLogger('llm-proxy-guard');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_REQUESTS_PER_MINUTE = 20;
const WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Rate-limit state (in-memory — replace with Redis for multi-instance)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

@Injectable()
export class LlmProxyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest<Request>();
    const correlationId: string =
      (request as unknown as Record<string, unknown>).correlationId as string ?? 'unknown';

    // Identify caller — prefer JWT user id, fall back to remote IP.
    const reqExt = request as unknown as Record<string, unknown>;
    // 【缺陷6 修复】JwtAuthGuard 写的是 req.userId（不是 req.user.id），修正读取字段
    const userId: string =
      (reqExt.userId as string | undefined) ??
      request.ip ??
      'unknown';
    const key: string = `rate:${userId}`;

    const now: number = Date.now();
    const entry: RateLimitEntry | undefined = rateLimitMap.get(key);

    if (!entry || now >= entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return true;
    }

    entry.count++;

    if (entry.count > MAX_REQUESTS_PER_MINUTE) {
      incrementCounter('llm_proxy_rate_limit_hits_total', { user_id: userId });

      logger.warn('Rate limit exceeded', {
        correlation_id: correlationId,
        user_id: userId,
        count: entry.count,
        limit: MAX_REQUESTS_PER_MINUTE,
      });

      throw new HttpException(
        {
          code: HttpStatus.TOO_MANY_REQUESTS,
          data: null,
          message: `Rate limit exceeded. Max ${MAX_REQUESTS_PER_MINUTE} requests per minute.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
