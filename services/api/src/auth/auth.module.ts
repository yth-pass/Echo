import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SmsService } from './sms.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [AuthController],
  providers: [AuthService, SmsService],
  exports: [AuthService],
})
export class AuthModule {}
