import type { OnboardingSurveyJson } from './survey-schema';

export function buildDialogueOpening(survey: OnboardingSurveyJson): string {
  const tones = survey.toneTags?.slice(0, 2).join('、') || '轻松真诚';
  const city = survey.city?.trim();
  const place = city ? `在${city}约会时` : '约会时';
  return (
    `嗨～我是 Echo 入驻助手。接下来用你「${tones}」的口吻随便聊几句就好。\n\n` +
    `你可以说说：${place}最看重对方什么？不喜欢暧昧时你会怎么开口？或分享一件最近的小事～`
  );
}

export function isGreetingOnly(message: string): boolean {
  const t = message.trim().replace(/\s+/g, '');
  if (!t || t.length > 12) return false;
  return /^(你好|您好|嗨|哈喽|hi|hello|hey|在吗|早上好|晚上好)+[!！。~～]?$/iu.test(t);
}

export function buildGreetingReply(survey: OnboardingSurveyJson): string {
  const tones = survey.toneTags?.[0] ?? '真诚';
  return (
    `嗨～不用客气，就当跟朋友聊天。可以聊聊：你最看重对方哪一点？` +
    `或者拒绝让你不舒服的暧昧时，你会怎么说？（你问卷里选了「${tones}」这类语气，举例说说也行）`
  );
}

const OFFLINE_PROMPTS = (survey: OnboardingSurveyJson) => [
  '约会时你最看重对方哪一点？用你自己的话说一两句～',
  '如果有人越界或让你不适，你一般会怎么拒绝？',
  '闲着的时候你最爱聊什么？举个小例子也行。',
  survey.toneTags?.[0]
    ? `你选了「${survey.toneTags[0]}」这类语气，平时会怎么表达？随便说两句。`
    : '开开玩笑、吐槽一句也行，我想听听你的口吻。',
];

export function buildOfflineDialogueReply(
  turnCount: number,
  survey: OnboardingSurveyJson,
): string {
  const prompts = OFFLINE_PROMPTS(survey);
  const idx = Math.max(0, Math.min(turnCount - 1, prompts.length - 1));
  return prompts[idx] ?? prompts[0]!;
}
