/**
 * Push token registration controller (REQ-10).
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PushService } from './push.service';
import { AuditService } from '../audit/audit.service';

class RegisterDto {
  @IsString()
  token!: string;

  @IsString()
  @IsOptional()
  platform?: string;
}

@Controller('v1/push')
@UseGuards(JwtAuthGuard)
// 【缺陷9 修复】push 限流：每分钟 20 次
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class PushController {
  constructor(
    private readonly push: PushService,
    private readonly audit: AuditService,
  ) {}

  @Post('register')
  async register(
    @CurrentUser() userId: string,
    @Body() dto: RegisterDto,
  ) {
    await this.push.registerToken(userId, dto.token, dto.platform ?? 'android');
    // 【缺陷8 修复】审计：推送 token 注册
    await this.audit.log({
      userId,
      eventType: 'push_token_registered',
      summaryZh: `注册推送 token（平台=${dto.platform ?? 'android'}）`,
      referenceId: dto.token.slice(0, 8),
    });
    return { ok: true };
  }
}
