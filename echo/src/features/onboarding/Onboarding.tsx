/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { apiPostJson, getApiBaseUrl } from '../../api/client';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  BrainCircuit,
  Fingerprint,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import {
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
        return dialogueTurns >= 2 || dialogueLog.length >= 4;
      default:
        return true;
    }
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
    if (!dialogueInput.trim()) return;
    const msg = dialogueInput.trim();
    setDialogueInput('');
    setDialogueLog((prev) => [...prev, { role: 'user', text: msg }]);
    setLoading(true);
    if (hasApi) {
      const res = await apiPostJson<
        { message: string; sessionId?: string },
        { reply?: string; sessionId?: string; turnCount?: number }
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
      setDialogueTurns((t) => t + 1);
    }
    setLoading(false);
  };

  const next = async () => {
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
      setStepIndex(stepIndex + 1);
      if (step === 'style' && styleIdx === STYLE_SCENARIOS.length - 1) {
        setStyleIdx(0);
      }
      return;
    }
    setLoading(true);
    if (hasApi) {
      await apiPostJson('/onboarding/finalize', {});
    }
    setLoading(false);
    onComplete();
  };

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
                className="w-full bg-echo-card border border-white/10 rounded-xl px-3 py-2 text-sm"
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
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-5 h-5 text-echo-blue" />
                <h2 className="font-bold">再聊几句，捕捉你的语气</h2>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 mb-3 max-h-48">
                {dialogueLog.length === 0 && (
                  <p className="text-xs text-gray-500">助手：你好，用你自己的话介绍一下约会时你最看重什么？</p>
                )}
                {dialogueLog.map((m, i) => (
                  <p
                    key={i}
                    className={`text-xs p-2 rounded-lg ${
                      m.role === 'user' ? 'bg-echo-blue/10 ml-8' : 'bg-white/5 mr-8'
                    }`}
                  >
                    {m.role === 'user' ? '你' : '助手'}：{m.text}
                  </p>
                ))}
              </div>
              <input
                value={dialogueInput}
                onChange={(e) => setDialogueInput(e.target.value)}
                placeholder="输入回复…"
                className="w-full bg-echo-card border border-white/10 rounded-xl px-3 py-2 text-sm mb-2"
              />
              <button
                type="button"
                onClick={() => void sendDialogue()}
                disabled={loading || !dialogueInput.trim()}
                className="text-xs text-echo-blue font-bold mb-2"
              >
                发送本轮
              </button>
              <p className="text-[10px] text-gray-600">至少 2 轮对话后可继续（当前 {dialogueTurns} 轮）</p>
            </div>
          )}

          {step === 'finalize' && (
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                className="inline-block mb-4"
              >
                <Fingerprint className="w-12 h-12 text-echo-blue" />
              </motion.div>
              <h2 className="text-xl font-bold">分身正在孵化</h2>
              <p className="text-sm text-gray-500 mt-2">将写入语言风格并发布首条广场动态</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <button
        type="button"
        disabled={!canNext() || loading}
        onClick={() => void next()}
        className="mt-8 w-full bg-echo-blue text-echo-dark font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {loading ? '处理中…' : step === 'finalize' ? '进入广场' : '继续'}
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}
