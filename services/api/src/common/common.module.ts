import { Global, Module } from '@nestjs/common';
import { BlockFilterService } from './block-filter.service';

/**
 * 全局通用模块。
 *
 * BlockFilterService 通过 @Global 模块导出，
 * feed / sessions / matches 等任意模块无需显式 import 即可注入复用。
 */
@Global()
@Module({
  providers: [BlockFilterService],
  exports: [BlockFilterService],
})
export class CommonModule {}
