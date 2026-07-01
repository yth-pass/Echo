import type { AffectionState, RelationshipLabel } from './types';
import { AffectionStateStore } from './affection-state.store';
import { getMemoryBaseDir } from './memory-base-dir';

const LABEL_HINTS: Record<RelationshipLabel, string> = {
  stranger: 'Minimal familiarity — formal, no assumptions about shared history',
  acquaintance: 'Basic rapport — polite, no intimacy claims',
  friendly_acquaintance: 'Warm but light — friendly tone, avoid deep personal leaps',
  good_terms: 'Solid rapport — relaxed, cooperative tone',
  close: 'High intimacy — candid, emotionally open when appropriate',
  strained: 'High friction — neutral, brief, avoid provocative topics',
  distant: 'Cool distance — reserved, low engagement',
  friendly_but_cautious:
    'Warm surface, guarded trust — friendly tone but verify before treating inferences as facts',
};

export class AffectionOverlayService {
  private stateStore: AffectionStateStore;

  constructor(baseDir?: string) {
    this.stateStore = new AffectionStateStore(baseDir ?? getMemoryBaseDir());
  }

  async render(observerId: string, otherId: string): Promise<string> {
    const state: AffectionState = await this.stateStore.read(observerId, otherId);

    const label = state.relationship_label;
    const d = state.dimensions;
    const arc = state.repair_arc;
    let toneHint = LABEL_HINTS[label];

    if (arc?.is_in_repair_arc) {
      const progress = arc.positive_interactions_since_break;
      const remaining = 7 - progress;
      toneHint += ` — REPAIR ARC (${progress}/7): trust is fragile. `;
      if (remaining <= 2) {
        toneHint += `Nearly rebuilt — stay consistent, one misstep could undo progress.`;
      } else if (remaining <= 4) {
        toneHint += `Mid-recovery — be extra reliable, avoid any trust_break events.`;
      } else {
        toneHint += `Early rebuilding — be exceptionally consistent, trust gains are halved.`;
      }
    }

    let trustHint = 'moderate — confirm before stating inferred items as facts';
    if (d.trust >= 70) trustHint = 'high — statements treated as reliable';
    else if (d.trust <= 30) trustHint = 'low — verify before relying on memory';

    if (arc?.is_in_repair_arc) {
      trustHint += ' (REPAIR ARC — gains dampened, must earn back trust gradually)';
    }

    let tensionHint = 'low — tone may be relaxed';
    if (d.tension >= 40) tensionHint = 'elevated — keep responses neutral and concise';

    const progress = arc?.positive_interactions_since_break ?? 0;
    const lines = [
      `## Relationship with ${otherId}`,
      `- Label: ${label}`,
      `- Tone: ${toneHint}`,
      ...(arc?.is_in_repair_arc
        ? [`- Repair Arc: ${progress}/7 positive interactions toward trust recovery`]
        : []),
      `- Trust: ${trustHint}`,
      `- Tension: ${tensionHint}`,
      `- Familiarity: ${d.familiarity}, Warmth: ${d.warmth}`,
      'Never disclose items with share_policy do_not_repeat_to_subject',
    ];

    return lines.join('\n');
  }
}
