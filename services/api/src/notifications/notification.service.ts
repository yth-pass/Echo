import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LivePublisherService } from '../live/live-publisher.service';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LivePublisherService,
  ) {}

  /**
   * 创建一条通知并推送 live 事件给目标用户。
   * fromUserId === userId 时静默跳过（不给自己发通知）。
   * metadata 为结构化上下文（如 comment_reply 携带评论者名/新评论内容/被引用原评论），
   * 前端可据此渲染富卡片；旧客户端忽略该字段仍可读 title/body。
   */
  async create(opts: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    refType?: string;
    refId?: string;
    fromUserId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // 不给自己发通知
    if (opts.fromUserId && opts.fromUserId === opts.userId) return;

    await this.prisma.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        refType: opts.refType ?? null,
        refId: opts.refId ?? null,
        fromUserId: opts.fromUserId ?? null,
        metadataJson: (opts.metadata as any) ?? null,
      },
    });

    // 通过 live WS 推送给目标用户
    await this.live.publish({
      type: 'notification',
      userId: opts.userId,
      payload: { notificationType: opts.type },
    });
  }

  /** 获取通知列表（按时间倒序，最多 50 条）。 */
  async list(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      items: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        ref_type: n.refType,
        ref_id: n.refId,
        from_user_id: n.fromUserId,
        created_at: n.createdAt.toISOString(),
        metadata: n.metadataJson as Record<string, unknown> | null,
      })),
    };
  }

  /** 获取未读通知数量。 */
  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { count };
  }

  /** 标记一条通知为已读。 */
  async markRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
    return { read: true };
  }

  /** 标记所有通知为已读。 */
  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { readAll: true };
  }

  /** 删除一条通知（校验归属当前用户）。 */
  async delete(userId: string, notificationId: string) {
    await this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
    return { deleted: true };
  }
}
