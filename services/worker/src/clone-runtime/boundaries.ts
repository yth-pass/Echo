export function formatBoundariesClause(boundariesJson: unknown): string {
  if (!boundariesJson || typeof boundariesJson !== 'object') return '';
  const o = boundariesJson as Record<string, unknown>;

  // v2.2 rich format: socialBoundaries / contradictions
  const v2Parts: string[] = [];
  if (typeof o.socialBoundaries === 'string' && o.socialBoundaries.trim()) {
    v2Parts.push(`【社交边界 — 你必须遵守】\n${o.socialBoundaries.trim()}`);
  }
  if (typeof o.contradictions === 'string' && o.contradictions.trim()) {
    v2Parts.push(`【内在矛盾 — 在适当情境下自然展现】\n${o.contradictions.trim()}`);
  }

  // Legacy: forbiddenWords
  if (Array.isArray(o.forbiddenWords)) {
    const words = o.forbiddenWords
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean);
    if (words.length) {
      v2Parts.push(`禁止使用或讨论以下词语：${words.join('、')}`);
    }
  }

  // topicsToAvoid (v2.2 string or legacy array)
  if (typeof o.topicsToAvoid === 'string' && o.topicsToAvoid.trim()) {
    v2Parts.push(`回避话题：${o.topicsToAvoid.trim()}`);
  } else if (Array.isArray(o.topicsToAvoid)) {
    const topics = o.topicsToAvoid
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean);
    if (topics.length) {
      v2Parts.push(`回避话题：${topics.join('；')}`);
    }
  }

  if (!v2Parts.length) return '';

  // Append handoff marker if enabled
  if (o.handoff === true) {
    v2Parts.push('handoff=consent-only');
  }

  // v2.2 rich format uses newline-separated blocks; legacy uses inline join
  const hasV2Rich = typeof o.socialBoundaries === 'string' || typeof o.contradictions === 'string';
  return hasV2Rich ? v2Parts.join('\n\n') : ` ${v2Parts.join('；')}。`;
}

// 【缺陷6修复】从 boundariesJson 中提取 forbiddenWords 列表，用于生成后校验
export function extractForbiddenWords(boundariesJson: unknown): string[] {
  if (!boundariesJson || typeof boundariesJson !== 'object') return [];
  const o = boundariesJson as Record<string, unknown>;
  if (!Array.isArray(o.forbiddenWords)) return [];
  return o.forbiddenWords
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean);
}

// 【缺陷6修复】扫描文本是否包含禁用词（大小写不敏感），命中则返回该词，未命中返回 null
export function scanForbiddenWords(text: string, words: string[]): string | null {
  const lower = text.toLowerCase();
  for (const w of words) {
    if (lower.includes(w.toLowerCase())) return w;
  }
  return null;
}
