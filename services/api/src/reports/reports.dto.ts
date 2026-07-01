import { IsIn, IsOptional, IsString } from 'class-validator';

/** 举报目标类型白名单 */
export const REPORT_TARGET_TYPES = ['post', 'session', 'clone', 'user'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export class CreateReportDto {
  // 【缺陷5 修复】targetType 加白名单校验，防止任意字符串注入
  @IsIn(REPORT_TARGET_TYPES)
  targetType!: ReportTargetType;

  @IsString()
  targetId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
