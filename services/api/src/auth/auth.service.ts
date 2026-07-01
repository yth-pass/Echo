import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CloneStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { RegisterDto } from './auth.dto';
import { SmsService } from './sms.service';

export type AuthSessionPayload = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  onboardingComplete: boolean;
  isNewUser: boolean;
};

// 【安全适配·任务1】出参类型移除 refresh_token 字段（refresh token 改走 httpOnly cookie）
export type SnakeAuthResponse = {
  access_token: string;
  user_id: string;
  onboarding_complete: boolean;
  is_new_user: boolean;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly sms: SmsService,
  ) {}

  private otpKey(phone: string) {
    return `otp:${phone}`;
  }

  // 阿里云发送频率限制 key：60s 内同一手机号不可重发
  private otpThrottleKey(phone: string) {
    return `otp:throttle:${phone}`;
  }

  // 【缺陷7 修复】JWT 黑名单 key，存被吊销的 jti
  private jwtBlacklistKey(jti: string) {
    return `jwt:blacklist:${jti}`;
  }

  /** 当 .env 设置 BYPASS_REDIS=true 时跳过所有 Redis 操作（固定码 8888） */
  private get bypassRedis() {
    return process.env.BYPASS_REDIS === 'true';
  }

  private normalizePhone(phone: string) {
    return phone.replace(/\D/g, '');
  }

  // 【安全适配·任务1】改为 public，供 controller 在设置 cookie 后转换为出参；
  // 不再返回 refresh_token（已通过 httpOnly cookie 下发）
  toSnakeAuthResponse(payload: AuthSessionPayload): SnakeAuthResponse {
    return {
      access_token: payload.accessToken,
      user_id: payload.userId,
      onboarding_complete: payload.onboardingComplete,
      is_new_user: payload.isNewUser,
    };
  }

  async getOnboardingStatus(userId: string) {
    const clone = await this.prisma.digitalClone.findUnique({
      where: { userId },
      include: { personaPrompt: true },
    });
    const completedSession = await this.prisma.onboardingSession.findFirst({
      where: { userId, completed: true },
    });
    const onboardingComplete =
      clone?.status === CloneStatus.active &&
      !!clone?.personaPrompt &&
      !!completedSession;
    return {
      onboardingComplete,
      isNewUser: !onboardingComplete,
    };
  }

  /** Ensures a user row exists for OTP flow (no password). */
  async ensureUserByPhone(phone: string) {
    const normalized = this.normalizePhone(phone);
    let user = await this.prisma.user.findFirst({ where: { phone: normalized } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone: normalized,
          profile: { create: {} },
        },
      });
    }
    const { onboardingComplete, isNewUser } = await this.getOnboardingStatus(user.id);
    return { userId: user.id, phone: normalized, onboardingComplete, isNewUser };
  }

  // 【安全适配·任务1】返回 AuthSessionPayload（含 refreshToken），由 controller 写入 cookie
  async registerWithPassword(dto: RegisterDto): Promise<AuthSessionPayload> {
    const normalized = this.normalizePhone(dto.phone);
    const existingPhone = await this.prisma.user.findFirst({
      where: { phone: normalized },
    });
    if (existingPhone) {
      throw new ConflictException('Phone already registered');
    }

    if (dto.email) {
      const existingEmail = await this.prisma.user.findFirst({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        phone: normalized,
        email: dto.email ?? null,
        passwordHash,
        profile: {
          create: {
            displayName: dto.displayName ?? null,
          },
        },
      },
    });

    return this.issueTokensForUser(user.id);
  }

  async sendOtp(phone: string) {
    const normalized = this.normalizePhone(phone);

    if (this.bypassRedis) {
      // BYPASS 模式：固定码 8888，不碰 Redis / 短信网关
      await this.ensureUserByPhone(normalized);
      this.logger.log(`OTP(bypass) for ${normalized}: 8888 — BYPASS_REDIS=true，跳过 Redis / 短信`);
      return { sent: true, phone: normalized };
    }

    const { userId } = await this.ensureUserByPhone(normalized);

    // 【缺陷1 修复】devCode 仅在非生产环境生效，生产环境完全忽略 OTP_DEV_CODE
    const isDev = process.env.NODE_ENV !== 'production';
    const devCode = isDev ? process.env.OTP_DEV_CODE?.trim() : undefined;

    // 60s 发送频率限制（dev / prod 通用，防刷）
    const throttleSet = await this.redis.client.set(
      this.otpThrottleKey(normalized),
      '1',
      'EX',
      60,
      'NX',
    );
    if (!throttleSet) {
      throw new HttpException('操作过于频繁，请 60 秒后重试', 429);
    }

    if (devCode) {
      await this.redis.client.setex(this.otpKey(normalized), 600, devCode);
      this.logger.log(`OTP(dev) for ${normalized}: ${devCode} — 走本地兜底，未调用短信网关`);
    } else {
      const { code } = await this.sms.sendVerifyCode(normalized);
      await this.redis.client.setex(this.otpKey(normalized), 600, code);
      this.logger.log(`OTP(aliyun) for ${normalized}: ${code} — 已通过阿里云下发并存入 Redis`);
    }

    // 【缺陷8 修复】审计：OTP 发送
    await this.audit.log({
      userId,
      eventType: 'otp_sent',
      summaryZh: `向手机号 ${normalized} 发送 OTP 验证码`,
    });

    return { sent: true, phone: normalized };
  }

  async loginWithOtp(phone: string, code: string): Promise<AuthSessionPayload> {
    const normalized = this.normalizePhone(phone);

    if (this.bypassRedis) {
      // BYPASS 模式：固定码 8888，纯本地校验
      if (code !== '8888') {
        throw new UnauthorizedException('Invalid OTP');
      }
      const user = await this.prisma.user.findFirst({ where: { phone: normalized } });
      if (!user) throw new UnauthorizedException('User not found');
      this.logger.log(`loginWithOtp(bypass) phone=${normalized} — 固定码校验通过`);
      return this.issueTokensForUser(user.id);
    }

    const stored = await this.redis.client.get(this.otpKey(normalized));

    // 【缺陷1 修复】devCode 仅在非生产环境生效
    const isDev = process.env.NODE_ENV !== 'production';
    const devCode = isDev ? process.env.OTP_DEV_CODE?.trim() : undefined;

    const user = await this.prisma.user.findFirst({ where: { phone: normalized } });

    // 统一校验：Redis 里存的是明文验证码（dev 模式存固定码，生产模式存阿里云回传的码）
    const valid = !!stored && (stored === code || (!!devCode && code === devCode));
    this.logger.log(`loginWithOtp phone=${normalized} stored=[${stored}] input=[${code}] devCode=[${devCode ?? ''}] valid=${valid}`);

    if (!valid) {
      if (user) {
        await this.audit.log({
          userId: user.id,
          eventType: 'login_failed',
          summaryZh: `手机号 ${normalized} OTP 登录失败（验证码错误）`,
        });
      }
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.redis.client.del(this.otpKey(normalized));
    if (!user) throw new UnauthorizedException('User not found');

    // 【缺陷8 修复】审计：OTP 登录成功
    await this.audit.log({
      userId: user.id,
      eventType: 'login_success',
      summaryZh: `手机号 ${normalized} OTP 登录成功`,
    });

    return this.issueTokensForUser(user.id);
  }

  // 【安全适配·任务1】返回 AuthSessionPayload（含 refreshToken），由 controller 写入 cookie
  async loginWithPassword(
    identifier: string,
    password: string,
  ): Promise<AuthSessionPayload> {
    const user = identifier.includes('@')
      ? await this.prisma.user.findFirst({ where: { email: identifier } })
      : await this.prisma.user.findFirst({
          where: { phone: this.normalizePhone(identifier) },
        });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokensForUser(user.id);
  }

  async refresh(refreshToken: string): Promise<AuthSessionPayload> {
    try {
      const payload = this.jwt.verify<{ sub: string; typ?: string; jti?: string }>(refreshToken);
      if (payload.typ !== 'refresh') throw new UnauthorizedException();

      if (!this.bypassRedis && payload.jti) {
        // 【缺陷7 修复】refresh token 也检查黑名单
        const blocked = await this.redis.client.get(this.jwtBlacklistKey(payload.jti));
        if (blocked) throw new UnauthorizedException('Token revoked');
      }

      return this.issueTokensForUser(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { select: { avatarUrl: true, displayName: true } } },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const { onboardingComplete, isNewUser } = await this.getOnboardingStatus(userId);
    return {
      userId: user.id,
      phone: user.phone,
      onboardingComplete,
      isNewUser,
      avatarUrl: user.profile?.avatarUrl ?? null,
      displayName: user.profile?.displayName ?? null,
    };
  }

  // 【缺陷7 修复】logout：将 access token 的 jti 加入 Redis 黑名单
  async logout(accessToken: string): Promise<{ loggedOut: true }> {
    try {
      const payload = this.jwt.verify<{ sub: string; jti?: string; exp?: number }>(accessToken);
      if (payload.jti) {
        // TTL = token 剩余有效期（秒），至少 1 秒
        const now = Math.floor(Date.now() / 1000);
        const ttl = payload.exp ? Math.max(1, payload.exp - now) : 900;
        await this.redis.client.setex(this.jwtBlacklistKey(payload.jti), ttl, '1');
      }
      return { loggedOut: true };
    } catch {
      // token 无效也返回成功，避免泄露 token 状态
      return { loggedOut: true };
    }
  }

  async issueTokensForUser(userId: string): Promise<AuthSessionPayload> {
    const { onboardingComplete, isNewUser } = await this.getOnboardingStatus(userId);

    // 【缺陷7 修复】access token 注入 jti，支持后续吊销
    const accessToken = this.jwt.sign({ sub: userId, jti: randomUUID() });
    const refreshToken = this.jwt.sign(
      { sub: userId, typ: 'refresh', jti: randomUUID() },
      { expiresIn: (process.env.JWT_REFRESH_TTL ?? '7d') as `${number}d` },
    );
    return {
      accessToken,
      refreshToken,
      userId,
      onboardingComplete,
      isNewUser,
    };
  }
}
