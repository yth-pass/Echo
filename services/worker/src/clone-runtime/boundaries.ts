export function formatBoundariesClause(boundariesJson: unknown): string {
  if (!boundariesJson || typeof boundariesJson !== 'object') return '';
  const o = boundariesJson as Record<string, unknown>;
  const parts: string[] = [];
  if (Array.isArray(o.forbiddenWords)) {
    const words = o.forbiddenWords
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean);
    if (words.length) {
      parts.push(`禁止使用或讨论以下词语：${words.join('、')}`);
    }
  }
  if (typeof o.topicsToAvoid === 'string' && o.topicsToAvoid.trim()) {
    parts.push(`回避话题：${o.topicsToAvoid.trim()}`);
  }
  if (!parts.length) return '';
  return ` ${parts.join('；')}。`;
}
