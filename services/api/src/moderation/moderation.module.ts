/**
 * NestJS module that exposes {@link ModerationService}.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { LlmService } from '../llm/llm.service';

@Module({
  providers: [
    {
      provide: ModerationService,
      useFactory: (llm: LlmService) => new ModerationService(llm),
      inject: [LlmService],
    },
  ],
  exports: [ModerationService],
})
export class ModerationModule {}
