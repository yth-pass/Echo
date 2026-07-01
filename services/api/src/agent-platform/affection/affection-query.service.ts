import { promises as fs } from 'fs';
import * as path from 'path';
import { getMemoryBaseDir } from './memory-base-dir';

export interface AffectionState {
  other_agent_id: string;
  dimensions: {
    familiarity: number;
    warmth: number;
    trust: number;
    tension: number;
    tension_quality: 'situational' | 'structural';
  };
  composite_affinity: number;
  relationship_label: string;
  last_updated_at: string;
  last_interaction_at?: string;
  version: number;
}

const DEFAULT_STATE: Omit<AffectionState, 'other_agent_id'> = {
  dimensions: { familiarity: 0, warmth: 0, trust: 0, tension: 0, tension_quality: 'situational' },
  composite_affinity: 0,
  relationship_label: 'stranger',
  last_updated_at: '',
  version: 1,
};

export class AffectionQueryService {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? getMemoryBaseDir();
  }

  private getStoragePath(observerId: string, otherId: string): string {
    return path.join(this.baseDir, 'users', observerId, 'social', 'by_agent', otherId, 'affection.json');
  }

  async getAffectionState(observerId: string, otherId: string): Promise<AffectionState> {
    const filePath = this.getStoragePath(observerId, otherId);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const state = JSON.parse(content) as AffectionState;
      return state;
    } catch {
      const init: AffectionState = {
        other_agent_id: otherId,
        ...DEFAULT_STATE,
        last_updated_at: new Date().toISOString(),
      };
      return init;
    }
  }
}
