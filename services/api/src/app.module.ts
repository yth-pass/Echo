import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
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

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as `${number}m` },
    }),
    PrismaModule,
    RedisModule,
    LlmModule,
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
  ],
})
export class AppModule {}
