/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AvatarService } from './avatar.service';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
// Max 2MB — COS upload or Base64 fallback both handle this size
const MAX_SIZE = Number(process.env.AVATAR_MAX_SIZE_BYTES ?? 2_097_152);

@Controller('avatar')
@UseGuards(JwtAuthGuard)
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  @Post()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          cb(new BadRequestException('仅支持 JPEG / PNG / WebP 格式'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('请选择一个图片文件');
    return this.avatarService.uploadAvatar(userId, file);
  }

  @Get()
  async get(@CurrentUser() userId: string) {
    return this.avatarService.getAvatar(userId);
  }

  @Delete()
  async remove(@CurrentUser() userId: string) {
    return this.avatarService.removeAvatar(userId);
  }
}
