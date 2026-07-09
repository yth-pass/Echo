import { Module } from '@nestjs/common';
import { LiveModule } from '../live/live.module';
import { NotificationModule } from '../notifications/notification.module';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [LiveModule, NotificationModule],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
