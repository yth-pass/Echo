import { Global, Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { LlmProxyController } from './llm-proxy.controller';

@Global()
@Module({
  providers: [LlmService],
  controllers: [LlmProxyController],
  exports: [LlmService],
})
export class LlmModule {}
