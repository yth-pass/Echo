import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LiveModule } from '../live/live.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { HandoffsController } from './handoffs.controller';
import { HandoffsService } from './handoffs.service';

@Module({
  imports: [PrismaModule, AuditModule, LiveModule, PushModule],
  controllers: [HandoffsController],
  providers: [HandoffsService],
})
export class HandoffsModule {}
