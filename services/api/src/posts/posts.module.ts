import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { CommentsController } from './comments.controller';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [ModerationModule, NotificationModule],
  controllers: [PostsController, CommentsController],
})
export class PostsModule {}
