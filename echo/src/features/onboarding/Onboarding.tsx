/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { apiPostJson, getApiBaseUrl } from '../../api/client';
import { saveTokens } from '../../api/auth';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  Fingerprint,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  DIALOGUE_MAX_TURNS,
  DIALOGUE_MIN_TURNS,
  INTEREST_PRESETS,
  STYLE_SCENARIOS,
  TONE_OPTIONS,
  VALUES_QUESTIONS,
} from './surveySteps';

type StepKind =
  | 'basics'
  | 'style'
  | 'tones'
  | 'sample'
  | 'values'
  | 'consent'
  | 'dialogue'
  | 'finalize';

const STEP_ORDER: StepKind[] = [
  'basics',
  'style',
  'tones',
  'sample',
  'values',
  'consent',
  'dialogue',
  'finalize',
];

const FINALIZE_MIN_MS = 5000;

type FinalizePhase = 'idle' | 'pending' | 'running' | 'done' | 'error';

type FinalizeResponse = {
  cloneId?: string;
  onboardingComplete?: boolean;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
};

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [city, setCity] = useState('');
  const [goal, setGoal] = useState('认真约会');
  const [displayName, setDisplayName] = useState('Echo 用户');
  const [interests, setInterests] = useState<string[]>([]);
  const [styleIdx, setStyleIdx] = useState(0);
  const [stylePicks, setStylePicks] = useState<Record<string, string>>({});
  const [toneTags, setToneTags] = useState<string[]>([]);
  const [sampleMessage, setSampleMessage] = useState('');
  const [valuesPicks, setValuesPicks] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [dialogueInput, setDialogueInput] = useState('');
  const [dialogueLog, setDialogueLog] = useState<{ role: 'user' | 'assistant'; text: string }[]>(
    [],
  );
  const [dialogueTurns, setDialogueTurns] = useState(0);
  const [loading, setLoading] = useState(false);
  const [finalizePhase, setFinalizePhase] = useState<FinalizePhase>('idle');
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [minDelayDone, setMinDelayDone] = useState(false);
  const finalizeStartedAtRef = useRef<number | null>(null);
  const finalizeRanRef = useRef(false);

  const step = STEP_ORDER[stepIndex];
  const hasApi = Boolean(getApiBaseUrl());

  const surveyPayload = useMemo(
    () => ({
      displayName,
      city,
      goal,
      interests,
      styleReplies: STYLE_SCENARIOS.map((s) => {
        const choiceId = stylePicks[s.id];
        const choice = s.choices.find((c) => c.id === choiceId);
        return {
          scenarioId: s.id,
          choiceId: choiceId ?? '',
          text: choice?.text ?? '',
        };
      }),
      toneTags,
      sampleMessage: sampleMessage.trim() || undefined,
      valuesChoices: VALUES_QUESTIONS.map((q) => {
        const choiceId = valuesPicks[q.id];
        const choice = q.choices.find((c) => c.id === choiceId);
        return {
          questionId: q.id,
          choiceId: choiceId ?? '',
          label: choice?.label ?? '',
        };
      }),
    }),
    [city, displayName, goal, interests, sampleMessage, stylePicks, toneTags, valuesPicks],
  );

  const dialogueAtMax = dialogueTurns >= DIALOGUE_MAX_TURNS;

  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 4 ? [...prev, tag] : prev,
    );
  };

  const toggleTone = (tag: string) => {
    setToneTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 3 ? [...prev, tag] : prev,
    );
  };

  const submitSurvey = async () => {
    if (!hasApi) return;
    const res = await apiPostJson<typeof surveyPayload, { sessionId?: string }>(
      '/onboarding/survey',
      surveyPayload,
    );
    if (res?.sessionId) setSessionId(res.sessionId);
  };

  const sendDialogue = async () => {
    if (!dialogueInput.trim() || dialogueAtMax) return;
    const msg = dialogueInput.trim();
    setDialogueInput('');
    setDialogueLog((prev) => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    if (hasApi) {
      const res = await apiPostJson<
        { message: string; sessionId?: string },
        { reply?: string; sessionId?: string; turnCount?: number; maxReached?: boolean }
      >('/onboarding/dialogue/turn', { message: msg, sessionId });
      if (res?.sessionId) setSessionId(res.sessionId);
      if (res?.reply) {
        setDialogueLog((prev) => [...prev, { role: 'assistant', text: res.reply! }]);
      }
      setDialogueTurns(res?.turnCount ?? dialogueTurns + 1);
    } else {
      setDialogueLog((prev) => [
        ...prev,
        { role: 'assistant', text: '谢谢，这很有帮助！还有想补充的吗？' },
      ]);
      setDialogueTurns((t) => Math.min(DIALOGUE_MAX_TURNS, t + 1));
    }
    setLoading(false);
  };

  const handleDialogueKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && dialogueInput.trim() && !dialogueAtMax) {
        void sendDialogue();
      }
    }
  };

  const runFinalize = useCallback(async () => {
    setFinalizePhase('running');
    setFinalizeError(null);
    setMinDelayDone(false);
    finalizeStartedAtRef.current = Date.now();

    const minDelay = new Promise<void>((resolve) => {
      setTimeout(resolve, FINALIZE_MIN_MS);
    });

    const work = async (): Promise<boolean> => {
      if (hasApi) {
        const res = await apiPostJson<Record<string, never>, FinalizeResponse>(
          '/onboarding/finalize',
          {},
        );
        if (!res?.onboardingComplete) {
          setFinalizeError('孵化失败，请检查网络后重试');
          return false;
        }
        if (res.accessToken && res.refreshToken && res.userId) {
          saveTokens({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            userId: res.userId,
          });
        }
        return true;
      }
      await new Promise((r) => setTimeout(r, FINALIZE_MIN_MS));
      return true;
    };

    const [ok] = await Promise.all([work(), minDelay]);
    setMinDelayDone(true);
    if (ok) {
      setFinalizePhase('done');
    } else {
      setFinalizePhase('error');
    }
  }, [hasApi]);

  useEffect(() => {
    if (step !== 'finalize') {
      finalizeRanRef.current = false;
      return;
    }
    if (finalizePhase !== 'pending' || finalizeRanRef.current) return;
    finalizeRanRef.current = true;
    void runFinalize();
  }, [step, finalizePhase, runFinalize]);

  const canNext = () => {
    switch (step) {
      case 'basics':
        return city.trim().length > 0 && interests.length >= 1;
      case 'style':
        return !!stylePicks[STYLE_SCENARIOS[styleIdx].id];
      case 'tones':
        return toneTags.length >= 2;
      case 'sample':
        return true;
      case 'values':
        return VALUES_QUESTIONS.every((q) => valuesPicks[q.id]);
      case 'consent':
        return true;
      case 'dialogue':
        return dialogueTurns >= DIALOGUE_MIN_TURNS;
      case 'finalize':
        return finalizePhase === 'done' && minDelayDone;
      default:
        return true;
    }
  };

  const next = async () => {
    if (step === 'finalize') {
      if (finalizePhase === 'error') {
        setFinalizePhase('pending');
        finalizeRanRef.current = false;
        return;
      }
      if (finalizePhase === 'done' && minDelayDone) {
        onComplete();
      }
      return;
    }

    if (step === 'values') {
      await submitSurvey();
    }
    if (step === 'dialogue' && dialogueInput.trim()) {
      await sendDialogue();
      return;
    }
    if (stepIndex < STEP_ORDER.length - 1) {
      if (step === 'style' && styleIdx < STYLE_SCENARIOS.length - 1) {
        setStyleIdx(styleIdx + 1);
        return;
      }
      const nextIndex = stepIndex + 1;
      if (STEP_ORDER[nextIndex] === 'finalize') {
        setFinalizePhase('pending');
        finalizeRanRef.current = false;
      }
      setStepIndex(nextIndex);
      if (step === 'style' && styleIdx === STYLE_SCENARIOS.length - 1) {
        setStyleIdx(0);
      }
    }
  };

  const primaryLabel = () => {
    if (step === 'finalize') {
      if (finalizePhase === 'error') return '重试孵化';
      if (finalizePhase === 'done' && minDelayDone) return '孵化完成，进入广场';
      return '分身孵化中…';
    }
    return '继续';
  };

  const primaryDisabled =
    step === 'finalize'
      ? finalizePhase === 'running' ||
        (finalizePhase === 'done' && !minDelayDone) ||
        (finalizePhase !== 'done' && finalizePhase !== 'error')
      : !canNext() || loading;

  const primaryClassName =
    step === 'finalize' && (finalizePhase === 'running' || (finalizePhase === 'done' && !minDelayDone))
      ? 'mt-8 w-full bg-white/15 text-gray-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed'
      : 'mt-8 w-full bg-echo-blue text-echo-dark font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40';

  const titleForStep = () => {
    switch (step) {
      case 'basics':
        return '基础画像';
      case 'style':
        return `语言风格 ${styleIdx + 1}/${STYLE_SCENARIOS.length}`;
      case 'tones':
        return '语气标签';
      case 'sample':
        return '常用表达（可选）';
      case 'values':
        return '价值观';
      case 'consent':
        return '分身授权';
      case 'dialogue':
        return 'AI 补充对话';
      case 'finalize':
        return '孵化分身';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-echo-dark flex flex-col p-6 justify-center max-w-md mx-auto">
      <div className="mb-6">
        <div className="bg-white/5 h-1 w-full rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-echo-blue"
            animate={{ width: `${((stepIndex + 1) / STEP_ORDER.length) * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-500 mt-2 text-center">
          {stepIndex + 1} / {STEP_ORDER.length} · {titleForStep()}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${step}-${styleIdx}`}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          className="flex-1 flex flex-col"
        >
          {step === 'basics' && (
            <div className="space-y-4 text-left w-full">
              <h2 className="text-xl font-bold text-center mb-2">快速问卷</h2>
              <p className="text-sm text-gray-500 text-center mb-4">
                参考 Hinge/Bumble 短提示，用于生成语言风格分身。
              </p>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="昵称"
                className="w-full bg-echo-card border border-white/10 rounded-xl px-3 py-2 text-sm"
              />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="城市，如：上海"
                className="w-full bg-echo-card border border-white/10 rounded-xl px-3 py-2 text-sm"
              />
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full bg-echo-card border border-white/10 rounded-xl px-3 py-2 text-sm"
              >
                <option value="认真约会">认真约会</option>
                <option value="先交朋友">先交朋友</option>
                <option value="慢慢来">慢慢来</option>
              </select>
              <p className="text-[10px] text-gray-500">选 1–4 个兴趣</p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleInterest(t)}
                    className={`text-xs px-3 py-1 rounded-full border ${
                      interests.includes(t)
                        ? 'bg-echo-blue/20 border-echo-blue text-echo-blue'
                        : 'border-white/10 text-gray-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'style' && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-2">{STYLE_SCENARIOS[styleIdx].prompt}</h2>
              <div className="space-y-2">
                {STYLE_SCENARIOS[styleIdx].choices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setStylePicks((p) => ({ ...p, [STYLE_SCENARIOS[styleIdx].id]: c.id }))
                    }
                    className={`w-full text-left p-3 rounded-xl border text-sm ${
                      stylePicks[STYLE_SCENARIOS[styleIdx].id] === c.id
                        ? 'border-echo-blue bg-echo-blue/10'
                        : 'border-white/10 bg-echo-card'
                    }`}
                  >
                    {c.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'tones' && (
            <div className="text-center w-full">
              <h2 className="text-lg font-bold mb-2">选 2–3 个语气词</h2>
              <div className="flex flex-wrap gap-2 justify-center">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTone(t)}
                    className={`px-4 py-2 rounded-full text-sm font-bold ${
                      toneTags.includes(t)
                        ? 'bg-echo-blue text-echo-dark'
                        : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'sample' && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-2">你常发的一句话（可选）</h2>
              <textarea
                value={sampleMessage}
                onChange={(e) => setSampleMessage(e.target.value)}
                placeholder="例如：哈哈哈可以啊，周末见～"
                rows={3}
                className="w-full bg-echo-card border border-white/10 rounded-xl px-3 py-2 text-sm resize-y"
              />
            </div>
          )}

          {step === 'values' && (
            <div className="space-y-6 text-left w-full">
              {VALUES_QUESTIONS.map((q) => (
                <div key={q.id}>
                  <p className="text-sm font-bold mb-2">{q.prompt}</p>
                  <div className="space-y-2">
                    {q.choices.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setValuesPicks((p) => ({ ...p, [q.id]: c.id }))}
                        className={`w-full p-3 rounded-xl border text-sm text-left ${
                          valuesPicks[q.id] === c.id
                            ? 'border-echo-blue bg-echo-blue/10'
                            : 'border-white/10'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 'consent' && (
            <div className="text-center">
              <ShieldCheck className="w-12 h-12 text-echo-blue mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">分身授权书</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                我授权 Echo 利用问卷与对话数据生成数字分身，在广场及私聊中代表我进行初步互动，并保留 Handoff
                否决权。
              </p>
            </div>
          )}

          {step === 'dialogue' && (
            <div className="w-full flex flex-col min-h-[280px]">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="w-5 h-5 text-echo-blue shrink-0" />
                <h2 className="font-bold">再聊几句，捕捉你的语气</h2>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                建议聊 4–6 轮，最多 {DIALOGUE_MAX_TURNS} 轮（当前 {dialogueTurns} / {DIALOGUE_MAX_TURNS}）
              </p>
              <div className="flex-1 overflow-y-auto space-y-2 mb-3 max-h-48">
                {dialogueLog.length === 0 && (
                  <p className="text-xs text-gray-500 whitespace-pre-wrap">
                    助手：你好，用你自己的话介绍一下约会时你最看重什么？
                  </p>
                )}
                {dialogueLog.map((m, i) => (
                  <p
                    key={i}
                    className={`text-xs p-2 rounded-lg whitespace-pre-wrap break-words ${
                      m.role === 'user' ? 'bg-echo-blue/10 ml-4' : 'bg-white/5 mr-4'
                    }`}
                  >
                    {m.role === 'user' ? '你' : '助手'}：{m.text}
                  </p>
                ))}
              </div>
              <textarea
                value={dialogueInput}
                onChange={(e) => setDialogueInput(e.target.value)}
                onKeyDown={handleDialogueKeyDown}
                placeholder="输入回复…（Enter 发送，Shift+Enter 换行）"
                rows={3}
                disabled={dialogueAtMax || loading}
                className="w-full bg-echo-card border border-white/10 rounded-xl px-3 py-2.5 text-sm mb-2 resize-y break-words disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void sendDialogue()}
                disabled={loading || !dialogueInput.trim() || dialogueAtMax}
                className="w-full py-2.5 px-5 rounded-xl bg-echo-blue/20 border border-echo-blue/40 text-echo-blue text-sm font-bold mb-2 disabled:opacity-40"
              >
                发送
              </button>
              <p className="text-[10px] text-gray-600">
                {dialogueTurns < DIALOGUE_MIN_TURNS
                  ? `至少 ${DIALOGUE_MIN_TURNS} 轮后可继续（当前 ${dialogueTurns} 轮）`
                  : dialogueAtMax
                    ? '已达对话上限，请点击下方「继续」进入孵化'
                    : `已满 ${DIALOGUE_MIN_TURNS} 轮，可随时点击「继续」`}
              </p>
            </div>
          )}

          {step === 'finalize' && (
            <div className="text-center">
              <motion.div
                animate={{ rotate: finalizePhase === 'done' ? 0 : 360 }}
                transition={
                  finalizePhase === 'done'
                    ? { duration: 0.3 }
                    : { repeat: Infinity, duration: 4, ease: 'linear' }
                }
                className="inline-block mb-4"
              >
                <Fingerprint className="w-12 h-12 text-echo-blue" />
              </motion.div>
              <h2 className="text-xl font-bold">
                {finalizePhase === 'done' ? '孵化完成' : '分身正在孵化'}
              </h2>
              <p className="text-sm text-gray-500 mt-2">
                {finalizePhase === 'done'
                  ? '已写入语言风格并排队发布首条广场动态'
                  : '将写入语言风格并排队发布首条广场动态'}
              </p>
              {finalizePhase === 'error' && finalizeError && (
                <p className="text-sm text-red-400 mt-3">{finalizeError}</p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <button
        type="button"
        disabled={primaryDisabled}
        onClick={() => void next()}
        className={primaryClassName}
      >
        {loading && step !== 'finalize' ? '处理中…' : primaryLabel()}
        {!(step === 'finalize' && finalizePhase === 'running') && (
          <ArrowRight className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
