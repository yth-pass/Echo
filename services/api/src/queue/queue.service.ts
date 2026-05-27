import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from '../redis/redis.service';

export const QUEUE_NAMES = {
  POST_DRAFT: 'post-draft',
  MODERATION: 'moderation',
  MATCH_DAILY: 'match-daily',
  AGENT_TURN: 'agent-turn',
  REPORT_TRIAGE: 'report-triage',
} as const;

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();

  constructor(private readonly redis: RedisService) {}

  private getQueue(name: string): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: this.redis.client });
      this.queues.set(name, q);
    }
    return q;
  }

  async enqueuePostDraft(payload: {
    cloneId: string;
    content?: string;
    trigger?: string;
    context?: Record<string, unknown>;
  }) {
    await this.getQueue(QUEUE_NAMES.POST_DRAFT).add('draft', {
      cloneId: payload.cloneId,
      content: payload.content ?? '',
      trigger: payload.trigger ?? 'manual',
      context: payload.context ?? {},
    });
  }

  async enqueueModeration(payload: { postId: string }) {
    await this.getQueue(QUEUE_NAMES.MODERATION).add('moderate', payload);
  }

  async enqueueMatchDaily() {
    await this.getQueue(QUEUE_NAMES.MATCH_DAILY).add('run', {});
  }

  async enqueueAgentTurn(payload: { sessionId: string }) {
    await this.getQueue(QUEUE_NAMES.AGENT_TURN).add('turn', payload);
  }

  async enqueueReportTriage(payload: {
    reportId: string;
    targetType: string;
    targetId: string;
    reporterId: string;
    reason?: string;
  }) {
    await this.getQueue(QUEUE_NAMES.REPORT_TRIAGE).add('triage', payload);
  }

  onModuleDestroy() {
    for (const q of this.queues.values()) {
      q.close();
    }
  }
}
