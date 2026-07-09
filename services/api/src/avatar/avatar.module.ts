/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Module } from '@nestjs/common';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';
import { CosModule } from '../cos/cos.module';

@Module({
  imports: [CosModule],
  controllers: [AvatarController],
  providers: [AvatarService],
  exports: [AvatarService],
})
export class AvatarModule {}
