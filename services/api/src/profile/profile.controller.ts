/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Controller, Get, Param, Put, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './profile.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('profile')
  async get(@CurrentUser() userId: string) {
    return this.profileService.getProfile(userId);
  }

  @Get('users/:userId/profile')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async getPublicProfile(
    @CurrentUser() currentUserId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.profileService.getPublicProfile(targetUserId, currentUserId);
  }

  @Put('profile')
  async update(@CurrentUser() userId: string, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(userId, dto);
  }
}
