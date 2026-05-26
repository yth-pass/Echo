/** Canonical onboarding survey shape stored in Profile.bioJson / OnboardingSession.surveyJson */

export type StyleReply = {
  scenarioId: string;
  choiceId: string;
  text: string;
};

export type ValuesChoice = {
  questionId: string;
  choiceId: string;
  label: string;
};

export type OnboardingSurveyJson = {
  displayName?: string;
  city?: string;
  goal?: string;
  interests?: string[];
  styleReplies?: StyleReply[];
  toneTags?: string[];
  sampleMessage?: string;
  valuesChoices?: ValuesChoice[];
  extra?: Record<string, unknown>;
};

export function buildPersonaSeedFromSurvey(survey: OnboardingSurveyJson): string {
  const tones = survey.toneTags?.length ? survey.toneTags.join('、') : '真诚';
  const samples =
    survey.styleReplies?.map((r) => r.text).filter(Boolean).join('；') ?? '';
  const values =
    survey.valuesChoices?.map((v) => v.label).join('；') ?? '';
  const sample = survey.sampleMessage?.trim() ?? '';
  return [
    `Echo 数字分身，城市 ${survey.city ?? '未知'}，目标 ${survey.goal ?? '认真约会'}。`,
    `兴趣：${(survey.interests ?? []).join('、') || '广泛'}`,
    `语气标签：${tones}`,
    samples ? `典型回复风格：${samples}` : '',
    sample ? `用户常发的一句：${sample}` : '',
    values ? `价值观选择：${values}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
