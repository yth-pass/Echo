/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CosService } from '../cos/cos.service';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class AvatarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cos: CosService,
  ) {}

  /**
   * Upload avatar image.
   * - If COS is configured: upload to COS, store public URL in DB.
   * - If COS is not configured (local dev): fall back to Base64 Data URI.
   */
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

    const buffer = file.buffer;
    if (!buffer) {
      throw new Error('File buffer is empty');
    }

    // Get old avatar URL for cleanup
    const oldProfile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { avatarUrl: true },
    });

    let avatarUrl: string;

    if (this.cos.isConfigured()) {
      // Upload to COS — returns permanent public URL
      avatarUrl = await this.cos.uploadAvatar(userId, buffer, file.mimetype);
    } else {
      // Fallback: Base64 Data URI (local dev without COS)
      const base64 = buffer.toString('base64');
      avatarUrl = `data:${file.mimetype};base64,${base64}`;
    }

    // Overwrite old avatar URL
    await this.prisma.profile.update({
      where: { userId },
      data: { avatarUrl },
    });

    // Best-effort: delete old COS object (skip if it was Base64)
    if (oldProfile?.avatarUrl?.startsWith('https://')) {
      await this.cos.deleteByUrl(oldProfile.avatarUrl).catch(() => {});
    }

    return { avatarUrl };
  }

  /** Get current avatar URL. */
  async getAvatar(userId: string): Promise<{ avatarUrl: string | null }> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { avatarUrl: true },
    });
    return { avatarUrl: profile?.avatarUrl ?? null };
  }

  /** Delete avatar (set avatarUrl to null, best-effort delete COS object). */
  async removeAvatar(userId: string): Promise<{ removed: true }> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { avatarUrl: true },
    });

    if (profile?.avatarUrl?.startsWith('https://')) {
      await this.cos.deleteByUrl(profile.avatarUrl).catch(() => {});
    }

    await this.prisma.profile.update({
      where: { userId },
      data: { avatarUrl: null },
    });
    return { removed: true };
  }
}
