import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CloneStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export type AuthSessionPayload = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  onboardingComplete: boolean;
  isNewUser: boolean;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
  ) {}

  private otpKey(phone: string) {
    return `otp:${phone}`;
  }

  private normalizePhone(phone: string) {
    return phone.replace(/\D/g, '');
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

  async register(phone: string) {
    const normalized = this.normalizePhone(phone);
    let user = await this.prisma.user.findFirst({ where: { phone: normalized } });
    if (!user) {
      user = await this.prisma.user.create({ data: { phone: normalized } });
    }
    const { onboardingComplete, isNewUser } = await this.getOnboardingStatus(user.id);
    return { userId: user.id, phone: normalized, onboardingComplete, isNewUser };
  }

  async sendOtp(phone: string) {
    const normalized = this.normalizePhone(phone);
    await this.register(normalized);
    const code =
      process.env.OTP_DEV_CODE?.trim() ||
      String(Math.floor(100000 + Math.random() * 900000));
    await this.redis.client.setex(this.otpKey(normalized), 600, code);
    this.logger.log(`OTP for ${normalized}: ${code} (MVP — not for production)`);
    return { sent: true, phone: normalized };
  }

  async login(phone: string, code: string) {
    const normalized = this.normalizePhone(phone);
    const stored = await this.redis.client.get(this.otpKey(normalized));
    const devCode = process.env.OTP_DEV_CODE?.trim();
    const valid = stored === code || (devCode && code === devCode);
    if (!valid) throw new UnauthorizedException('Invalid OTP');
    await this.redis.client.del(this.otpKey(normalized));
    const user = await this.prisma.user.findFirst({ where: { phone: normalized } });
    if (!user) throw new UnauthorizedException('User not found');
    return this.issueTokens(user.id);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<{ sub: string; typ?: string }>(refreshToken);
      if (payload.typ !== 'refresh') throw new UnauthorizedException();
      return this.issueTokens(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    const { onboardingComplete, isNewUser } = await this.getOnboardingStatus(userId);
    return {
      userId: user.id,
      phone: user.phone,
      onboardingComplete,
      isNewUser,
    };
  }

  private async issueTokens(userId: string): Promise<AuthSessionPayload> {
    const { onboardingComplete, isNewUser } = await this.getOnboardingStatus(userId);
    const accessToken = this.jwt.sign({ sub: userId });
    const refreshToken = this.jwt.sign(
      { sub: userId, typ: 'refresh' },
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
