import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { HandoffsService } from './handoffs.service';

class RespondDto {
  @IsBoolean()
  accept!: boolean;
}

@Controller('handoffs')
@UseGuards(JwtAuthGuard)
export class HandoffsController {
  constructor(private readonly handoffs: HandoffsService) {}

  @Get(':id')
  get(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.handoffs.getOne(userId, id);
  }

  @Post(':id/respond')
  respond(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: RespondDto,
  ) {
    return this.handoffs.respond(userId, id, dto.accept);
  }
}
