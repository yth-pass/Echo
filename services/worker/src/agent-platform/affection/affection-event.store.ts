import { promises as fs } from 'fs';
import * as path from 'path';
import type { AffectionEvent } from './types';
import { getMemoryBaseDir } from './memory-base-dir';

export class AffectionEventStore {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? getMemoryBaseDir();
  }

  private getStoragePath(observerId: string, otherId: string, filename: string): string {
    return path.join(this.baseDir, 'users', observerId, 'social', 'by_agent', otherId, filename);
  }

  private async ensureDir(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  private async readJsonl(filePath: string): Promise<any[]> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  private async appendJsonl(filePath: string, records: unknown[]): Promise<void> {
    if (records.length === 0) return;
    await this.ensureDir(filePath);
    const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
    await fs.appendFile(filePath, lines, 'utf8');
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  async append(events: AffectionEvent[]): Promise<{ appended: AffectionEvent[]; skipped: AffectionEvent[] }> {
    if (events.length === 0) return { appended: [], skipped: [] };

    const appended: AffectionEvent[] = [];
    const skipped: AffectionEvent[] = [];

    // Group by (observer, other) to handle multiple pairs if needed, but typically one pair per call
    const byPair = new Map<string, AffectionEvent[]>();
    for (const evt of events) {
      const key = `${evt.observer_id}:${evt.other_id}`;
      if (!byPair.has(key)) byPair.set(key, []);
      byPair.get(key)!.push(evt);
    }

    for (const [key, evts] of byPair) {
      const [observerId, otherId] = key.split(':');
      const eventsPath = this.getStoragePath(observerId, otherId, 'affection_events.jsonl');

      const existing = await this.readJsonl(eventsPath);
      const existingCorrIds = new Set(
        existing
          .map((e) => e.correlation_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      );

      const toAppend: AffectionEvent[] = [];
      for (const evt of evts) {
        if (evt.correlation_id && existingCorrIds.has(evt.correlation_id)) {
          skipped.push(evt);
          continue;
        }
        // Also check by id for safety
        const idExists = existing.some((e) => e.id === evt.id);
        if (idExists) {
          skipped.push(evt);
          continue;
        }
        toAppend.push(evt);
        if (evt.correlation_id) existingCorrIds.add(evt.correlation_id);
      }

      if (toAppend.length > 0) {
        await this.appendJsonl(eventsPath, toAppend);
        appended.push(...toAppend);
      }
    }

    return { appended, skipped };
  }

  async readAll(observerId: string, otherId: string): Promise<AffectionEvent[]> {
    const eventsPath = this.getStoragePath(observerId, otherId, 'affection_events.jsonl');
    return (await this.readJsonl(eventsPath)) as AffectionEvent[];
  }
}
