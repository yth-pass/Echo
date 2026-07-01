import {
  buildPrefilterConditions,
  hasActiveMatchPrefs,
  rankCandidatesByRules,
  type MatchPrefs,
  type VectorCandidate,
} from '../src/clone-runtime/match-bridge';

describe('hasActiveMatchPrefs', () => {
  it('returns false for empty prefs', () => {
    expect(hasActiveMatchPrefs({})).toBe(false);
    expect(hasActiveMatchPrefs({ distanceKm: 50 })).toBe(false);
  });

  it('returns true when gender filter is set', () => {
    expect(hasActiveMatchPrefs({ gender: ['女'] })).toBe(true);
  });
});

describe('buildPrefilterConditions', () => {
  it('builds gender, age, and relationship intent SQL fragments', () => {
    const prefs: MatchPrefs = {
      gender: ['女', '非二元'],
      ageMin: 25,
      ageMax: 35,
      relationshipIntent: '认真约会',
    };
    const currentYear = new Date().getFullYear();

    const { conditions, params, nextIdx } = buildPrefilterConditions(prefs, 3);

    expect(conditions).toEqual([
      "COALESCE(p.gender, p.bio_json->>'gender') = ANY($3::text[])",
      "COALESCE(p.birth_year, (p.bio_json->>'birthYear')::int) >= $4",
      "COALESCE(p.birth_year, (p.bio_json->>'birthYear')::int) <= $5",
      "COALESCE(p.bio_json->>'goal', p.bio_json->>'datingGoal') = $6",
    ]);
    expect(params).toEqual([
      ['女', '非二元'],
      currentYear - 35,
      currentYear - 25,
      '认真约会',
    ]);
    expect(nextIdx).toBe(7);
  });
});

describe('rankCandidatesByRules', () => {
  const candidates: VectorCandidate[] = [
    { user_id: 'a', similarity: 0.5 },
    { user_id: 'b', similarity: 0.75 },
    { user_id: 'c', similarity: 0.7 },
    { user_id: 'd', similarity: 0.65 },
  ];

  it('applies rule boosts and returns top 3 by adjusted score', () => {
    const prefs: MatchPrefs = { relationshipIntent: '认真约会' };
    const seeker = {
      city: '上海',
      bioJson: { interests: ['电影', '咖啡'] },
    };
    const profiles = [
      { userId: 'a', city: '北京', bioJson: { goal: '随便聊聊', interests: ['电影'] } },
      { userId: 'b', city: '上海', bioJson: { goal: '认真约会', interests: ['咖啡'] } },
      { userId: 'c', city: '上海', bioJson: { goal: '认真约会', interests: ['徒步'] } },
      { userId: 'd', city: '广州', bioJson: { goal: '认真约会', interests: ['电影'] } },
    ];

    const ranked = rankCandidatesByRules(seeker, candidates, profiles, prefs, 3);

    expect(ranked).toHaveLength(3);
    expect(ranked[0].user_id).toBe('b');
    expect(ranked[0].adjustedScore).toBeCloseTo(0.75 + 0.1 + 0.05 + 0.05);
    expect(ranked.map((r) => r.user_id)).not.toContain('a');
  });
});
