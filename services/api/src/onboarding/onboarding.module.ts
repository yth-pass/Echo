import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { RedisModule } from '../redis/redis.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { PersonaSketchService } from './persona-sketch.service';
import { IdealPartnerSketchService } from './ideal-partner-sketch.service';
import { RoleplayAgentService } from './roleplay-agent.service';
import { StyleGeneratorService } from '../agent-platform/style/style-generator.service';

@Module({
  imports: [PrismaModule, LlmModule, AuditModule, QueueModule, RedisModule, AuthModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, PersonaSketchService, IdealPartnerSketchService, RoleplayAgentService, StyleGeneratorService],
  exports: [OnboardingService, IdealPartnerSketchService],
})
export class OnboardingModule {}
