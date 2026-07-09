/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import COS from 'cos-nodejs-sdk-v5';
import { Injectable, Logger } from '@nestjs/common';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class CosService {
  private readonly logger = new Logger(CosService.name);
  private readonly cos: COS | null = null;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    const secretId = process.env.COS_SECRET_ID;
    const secretKey = process.env.COS_SECRET_KEY;
    this.bucket = process.env.COS_BUCKET ?? '';
    this.region = process.env.COS_REGION ?? 'ap-shanghai';

    if (secretId && secretKey && this.bucket) {
      this.cos = new COS({ SecretId: secretId, SecretKey: secretKey });
      this.logger.log(`COS initialized: bucket=${this.bucket}, region=${this.region}`);
    } else {
      this.logger.warn('COS not configured — avatar uploads will fall back to Base64');
    }
  }

  /** COS is ready when all credentials are present. */
  isConfigured(): boolean {
    return this.cos !== null;
  }

  /**
   * Upload avatar image to COS and return the public URL.
   * Object key format: `avatars/{userId}/{timestamp}.{ext}`
   * Object ACL is set to `public-read` so the URL is permanently accessible.
   */
  async uploadAvatar(
    userId: string,
    buffer: Buffer,
    mimetype: string,
  ): Promise<string> {
    if (!this.cos) {
      throw new Error('COS is not configured');
    }

    const ext = MIME_TO_EXT[mimetype] ?? 'jpg';
    const timestamp = Date.now();
    const key = `avatars/${userId}/${timestamp}.${ext}`;

    await this.cos.putObject({
      Bucket: this.bucket,
      Region: this.region,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      ACL: 'public-read',
    });

    const url = `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`;
    this.logger.log(`Avatar uploaded: ${key}`);
    return url;
  }

  /**
   * Delete a COS object by its URL.
   * Silently skips if URL is not a COS URL (e.g. Base64 data URI).
   */
  async deleteByUrl(url: string): Promise<void> {
    if (!this.cos) return;
    if (!url || !url.startsWith('https://')) return;

    // Extract object key from URL
    const prefix = `https://${this.bucket}.cos.${this.region}.myqcloud.com/`;
    if (!url.startsWith(prefix)) return; // Not our COS URL

    const key = url.slice(prefix.length);
    if (!key) return;

    try {
      await this.cos.deleteObject({
        Bucket: this.bucket,
        Region: this.region,
        Key: key,
      });
      this.logger.log(`COS object deleted: ${key}`);
    } catch (err) {
      this.logger.warn(`Failed to delete COS object ${key}: ${err}`);
    }
  }
}
