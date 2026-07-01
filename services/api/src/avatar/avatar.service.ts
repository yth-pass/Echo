/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class AvatarService {
  constructor(private readonly prisma: PrismaService) {}

  /** 将上传图片转 Base64 Data URI 存入 Profile.avatarUrl。 */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    if (!file) {
      throw new Error('No file uploaded');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new Error('Only JPEG, PNG and WebP images are allowed');
    }

    // 读取文件 buffer（memoryStorage 模式下 file.buffer 已就绪）
    const buffer = file.buffer;
    if (!buffer) {
      throw new Error('File buffer is empty');
    }

    // 转 Base64 Data URI: data:image/jpeg;base64,<base64>
    const base64 = buffer.toString('base64');
    const dataUri = `data:${file.mimetype};base64,${base64}`;

    // 直接写入 Profile.avatarUrl（覆盖旧值，无需删文件）
    await this.prisma.profile.update({
      where: { userId },
      data: { avatarUrl: dataUri },
    });

    return { avatarUrl: dataUri };
  }

  /** 获取当前头像 Data URI。 */
  async getAvatar(userId: string): Promise<{ avatarUrl: string | null }> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { avatarUrl: true },
    });
    return { avatarUrl: profile?.avatarUrl ?? null };
  }

  /** 删除头像（置空 avatarUrl）。 */
  async removeAvatar(userId: string): Promise<{ removed: true }> {
    await this.prisma.profile.update({
      where: { userId },
      data: { avatarUrl: null },
    });
    return { removed: true };
  }
}
