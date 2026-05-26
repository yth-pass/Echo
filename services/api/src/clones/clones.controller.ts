import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CloneStatus } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CloneActivityService } from './clone-activity.service';
import { ClonesService } from './clones.service';

class UpdateCloneDto {
  @IsOptional()
  @IsEnum(CloneStatus)
  status?: CloneStatus;

  @IsOptional()
  @IsString()
  personaText?: string;
}

@Controller('clones')
@UseGuards(JwtAuthGuard)
export class ClonesController {
  constructor(
    private readonly clones: ClonesService,
    private readonly cloneActivity: CloneActivityService,
  ) {}

  @Get('me')
  me(@CurrentUser() userId: string) {
    return this.clones.getMe(userId);
  }

  @Put('me')
  update(@CurrentUser() userId: string, @Body() dto: UpdateCloneDto) {
    return this.clones.updateMe(userId, dto);
  }

  @Post('me/pause')
  pause(@CurrentUser() userId: string) {
    return this.clones.pause(userId);
  }

  @Post('me/resume')
  resume(@CurrentUser() userId: string) {
    return this.clones.resume(userId);
  }

  @Get('me/activity')
  listActivity(@CurrentUser() userId: string, @Query('type') type?: string) {
    return this.cloneActivity.list(userId, type);
  }
}
