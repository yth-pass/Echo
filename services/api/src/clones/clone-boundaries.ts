import { IsArray, IsOptional, IsString } from 'class-validator';

export type CloneBoundaries = {
  forbiddenWords: string[];
  topicsToAvoid: string | null;
};

export class CloneBoundariesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forbiddenWords?: string[];

  @IsOptional()
  @IsString()
  topicsToAvoid?: string;
}

export function normalizeForbiddenWords(input: string[] | undefined): string[] {
  if (!input?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const w = raw.trim();
    if (!w || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

export function parseBoundariesJson(raw: unknown): CloneBoundaries | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const forbiddenWords = Array.isArray(o.forbiddenWords)
    ? normalizeForbiddenWords(o.forbiddenWords.filter((x): x is string => typeof x === 'string'))
    : [];
  const topicsToAvoid =
    typeof o.topicsToAvoid === 'string' && o.topicsToAvoid.trim() ? o.topicsToAvoid.trim() : null;
  if (!forbiddenWords.length && !topicsToAvoid) return null;
  return { forbiddenWords, topicsToAvoid };
}

export function mergeBoundariesJson(
  existing: unknown,
  dto: CloneBoundariesDto,
): Record<string, unknown> {
  const prev = existing && typeof existing === 'object' ? (existing as Record<string, unknown>) : {};
  const forbiddenWords = normalizeForbiddenWords(dto.forbiddenWords);
  const topicsToAvoid =
    dto.topicsToAvoid === undefined
      ? typeof prev.topicsToAvoid === 'string'
        ? prev.topicsToAvoid
        : null
      : dto.topicsToAvoid.trim() || null;
  return {
    ...prev,
    handoff: prev.handoff ?? true,
    forbiddenWords,
    topicsToAvoid,
  };
}
