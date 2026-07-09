import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { LlmModule } from './llm/llm.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ClonesModule } from './clones/clones.module';
import { FeedModule } from './feed/feed.module';
import { MatchesModule } from './matches/matches.module';
import { SessionsModule } from './sessions/sessions.module';
import { HandoffsModule } from './handoffs/handoffs.module';
import { AuditApiModule } from './audit-api/audit-api.module';
import { ReportsModule } from './reports/reports.module';
import { PostsModule } from './posts/posts.module';
import { QueueModule } from './queue/queue.module';
import { LiveModule } from './live/live.module';
import { PushModule } from './push/push.module';
import { AvatarModule } from './avatar/avatar.module';
import { ProfileModule } from './profile/profile.module';
import { NotificationModule } from './notifications/notification.module';
import { CorrelationMiddleware } from './common/correlation.middleware';
import { CommonModule } from './common/common.module';

// 【缺陷4 修复】启动时校验 JWT_SECRET，移除硬编码 fallback，防止弱密钥启动
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    'FATAL: JWT_SECRET must be set and at least 32 characters long. Refusing to start.',
  );
}

@Module({
  imports: [
    // 【缺陷4 修复】移除 'dev-secret-change-me' fallback，使用启动校验后的真实密钥
    JwtModule.register({
      global: true,
      secret: jwtSecret,
      signOptions: { expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as `${number}m` },
    }),
    // 【缺陷2/9 修复】全局限流：默认 10 次/分钟，各控制器可用 @Throttle 覆盖
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 10 },
    ]),
    PrismaModule,
    AvatarModule,
    ProfileModule,
    RedisModule,
    LlmModule,
    // 【缺陷4 修复】全局注册 BlockFilterService，供各读取路径复用双向拉黑过滤
    CommonModule,
    AuditModule,
    QueueModule,
    HealthModule,
    AuthModule,
    OnboardingModule,
    ClonesModule,
    FeedModule,
    MatchesModule,
    SessionsModule,
    HandoffsModule,
    AuditApiModule,
    ReportsModule,
    PostsModule,
    LiveModule,
    PushModule,
    NotificationModule,
  ],
  // 【缺陷2/9 修复】全局启用 ThrottlerGuard，所有路由默认限流
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
