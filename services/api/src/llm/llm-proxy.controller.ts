/**
 * LLM Proxy controller — exposes `POST /v1/llm/proxy` so the browser client
 * never holds an API key directly (REQ-11).
 *
 * Protected by the {@link LlmProxyGuard} rate limiter.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LlmService } from './llm.service';
import { LlmProxyGuard } from './llm-proxy.guard';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { createLogger, incrementCounter } from '../../../shared/observability';

const logger = createLogger('llm-proxy');

// ---------------------------------------------------------------------------
// DTOs (inline to keep the scope contained)
// ---------------------------------------------------------------------------

interface LlmProxyMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LlmProxyOptions {
  temperature?: number;
  max_tokens?: number;
}

interface LlmProxyRequest {
  messages: LlmProxyMessage[];
  options?: LlmProxyOptions;
}

interface LlmProxyResponse {
  code: number;
  data: { content: string | null };
  message: string;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller('llm/proxy')
export class LlmProxyController {
  constructor(private readonly llmService: LlmService) {}

  @Post()
  // 【缺陷6 修复】加 JwtAuthGuard 鉴权，LlmProxyGuard 做 IP 限流
  @UseGuards(JwtAuthGuard, LlmProxyGuard)
  async proxy(
    @Body() body: LlmProxyRequest,
    @Req() req: Request,
  ): Promise<LlmProxyResponse> {
    const correlationId: string =
      (req as unknown as Record<string, unknown>).correlationId as string ?? 'unknown';

    const messageCount: number = body.messages?.length ?? 0;

    logger.info('LLM proxy request', {
      correlation_id: correlationId,
      message_count: messageCount,
    });

    incrementCounter('llm_proxy_requests_total', {
      message_count_bucket: messageCount <= 2 ? '1-2' : messageCount <= 10 ? '3-10' : '11+',
    });

    const content: string | null = await this.llmService.chat(
      body.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    );

    return {
      code: 0,
      data: { content },
      message: 'ok',
    };
  }
}
