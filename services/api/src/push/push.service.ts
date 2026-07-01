/**
 * Push notification service (REQ-10).
 *
 * Sends FCM push notifications via firebase-admin.
 * When the Firebase Admin SDK is not configured (missing credentials or
 * SDK), all operations degrade gracefully to console.warn.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createLogger } from '../../../shared/observability';

const obsLogger = createLogger('push');

/** Lazy-loaded admin/messaging references. */
let _messaging: any | null = undefined;

function getMessaging(): any | null {
  if (_messaging !== undefined) return _messaging;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require('firebase-admin');
    if (admin.apps.length === 0) {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!credPath) {
        obsLogger.warn('GOOGLE_APPLICATION_CREDENTIALS not set; push disabled');
        _messaging = null;
        return null;
      }
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }
    _messaging = admin.messaging();
    return _messaging;
  } catch (err) {
    obsLogger.warn('firebase-admin not available; push disabled', {
      error: err instanceof Error ? err.message : String(err),
    });
    _messaging = null;
    return null;
  }
}

export type PushType = 'match_push' | 'handoff' | 'handoff_accepted';

const TITLE_MAP: Record<PushType, string> = {
  match_push: '👋 新匹配推荐',
  handoff: '🔔 真人接力请求',
  handoff_accepted: '🤝 双方同意接力',
};

const BODY_MAP: Record<PushType, string> = {
  match_push: '有新的分身匹配，去看看是否合拍吧',
  handoff: '对方想和你开启真人交流，来回应吧',
  handoff_accepted: '你们已成功互选，可以交换联系方式了',
};

/** Android notification channel id (matches channels created in app). */
const ANDROID_CHANNEL_ID = 'echo_default';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Send a typed push notification to a specific user.
   *
   * Fetches all registered device tokens for that user and sends via FCM
   * multicast.  Failures are logged but never thrown — push delivery is
   * best-effort.
   */
  async sendPush(
    userId: string,
    type: PushType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const tokens = await this.getDeviceTokens(userId);
    if (tokens.length === 0) {
      obsLogger.info('no device tokens for user, skipping push', { userId, type });
      return;
    }

    const messaging = getMessaging();
    if (!messaging) {
      obsLogger.warn('FCM not available, push skipped', { userId, type, tokenCount: tokens.length });
      return;
    }

    const title = TITLE_MAP[type] ?? 'Echo';
    const body = BODY_MAP[type] ?? '';

    const message: any = {
      data: {
        type,
        payload: JSON.stringify(payload),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: ANDROID_CHANNEL_ID,
          title,
          body,
        },
      },
      tokens,
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      obsLogger.info('push sent', {
        userId,
        type,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
      if (response.failureCount > 0) {
        response.responses.forEach((r: any, idx: number) => {
          if (!r.success) {
            obsLogger.warn('FCM push failed for token', {
              userId,
              type,
              error: r.error?.message ?? 'unknown',
              tokenPrefix: tokens[idx]?.slice(0, 8),
            });
          }
        });
      }
    } catch (err) {
      obsLogger.warn('FCM multicast failed', {
        userId,
        type,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Register (or refresh) a device token for a user.
   *
   * Uses upsert on (userId, token) to avoid duplicates and update the
   * `updatedAt` timestamp on re-registration.
   */
  async registerToken(
    userId: string,
    token: string,
    platform: string = 'android',
  ): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { userId_token: { userId, token } },
      create: { userId, token, platform },
      update: { platform, updatedAt: new Date() },
    });
    obsLogger.info('device token registered', { userId, platform });
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  /**
   * Return all active FCM tokens for the given user.
   */
  private async getDeviceTokens(userId: string): Promise<string[]> {
    const rows = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });
    return rows.map((r) => r.token);
  }
}
