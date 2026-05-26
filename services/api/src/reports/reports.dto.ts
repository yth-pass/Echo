import { IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @IsString()
  targetType!: string;

  @IsString()
  targetId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
