/**
 * Push notification module (REQ-10).
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PushService } from './push.service';
import { PushController } from './push.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
