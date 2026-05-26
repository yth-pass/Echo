import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CloneActivityService } from './clone-activity.service';
import { ClonesController } from './clones.controller';
import { ClonesService } from './clones.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ClonesController],
  providers: [ClonesService, CloneActivityService],
})
export class ClonesModule {}
