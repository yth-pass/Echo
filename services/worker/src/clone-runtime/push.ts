/**
 * Worker-side push helper (REQ-10).
 *
 * Lightweight FCM push that uses the worker's PrismaClient directly.
 * Mirrors the API-side PushService but avoids NestJS DI.
 *
 * @license SPDX-License-Identifier: Apache-2.0
 */

import type { PrismaClient } from '@prisma/client';
import { createLogger } from '../../../shared/observability';

const logger = createLogger('worker-push');

let _messaging: any | null = undefined;

function getMessaging(): any | null {
  if (_messaging !== undefined) return _messaging;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require('firebase-admin');
    if (admin.apps.length === 0) {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!credPath) {
        logger.warn('GOOGLE_APPLICATION_CREDENTIALS not set; push disabled');
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
    logger.warn('firebase-admin not available; push disabled', {
      error: err instanceof Error ? err.message : String(err),
    });
    _messaging = null;
    return null;
  }
}

export type WorkerPushType = 'match_push' | 'handoff' | 'moderation_rejected';

const TITLE_MAP: Record<WorkerPushType, string> = {
  match_push: '👋 新匹配推荐',
  handoff: '🔔 真人接力请求',
  // 【缺陷6 修复】审核拒绝通知
  moderation_rejected: '⚠️ 内容未通过审核',
};

const BODY_MAP: Record<WorkerPushType, string> = {
  match_push: '有新的分身匹配，去看看是否合拍吧',
  handoff: '对方想和你开启真人交流，来回应吧',
  // 【缺陷6 修复】审核拒绝通知文案
  moderation_rejected: '你的分身发布的内容未通过审核',
};

const ANDROID_CHANNEL_ID = 'echo_default';

/**
 * Send a typed push notification to a specific user.
 *
 * Best-effort: failures are logged but never thrown.
 */
export async function sendPush(
  prisma: PrismaClient,
  userId: string,
  type: WorkerPushType,
  payload: Record<string, unknown>,
): Promise<void> {
  const rows = await prisma.deviceToken.findMany({
    where: { userId },
    select: { token: true },
  });
  const tokens = rows.map((r) => r.token);
  if (tokens.length === 0) return;

  const messaging = getMessaging();
  if (!messaging) return;

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
    logger.info('push sent', {
      userId,
      type,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (err) {
    logger.warn('FCM multicast failed', {
      userId,
      type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
