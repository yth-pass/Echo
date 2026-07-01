/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './profile.dto';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  async get(@CurrentUser() userId: string) {
    return this.profileService.getProfile(userId);
  }

  @Put()
  async update(@CurrentUser() userId: string, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(userId, dto);
  }
}
