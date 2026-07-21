/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 四层人格采集模型入驻向导（见 docs_CN/Onboarding-Survey-Redesign-Proposal.md）。
 * 模块：M1 身份基座 → M2 语言指纹（含关系情境）→ M3 信念系统 → 授权 → M4 深度对话 → 孵化
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { apiPostJson, getApiBaseUrl, unwrap } from '../../api/client';
import { saveTokens, scheduleProactiveRefresh } from '../../api/auth';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, MessageCircle, ShieldCheck } from 'lucide-react';
import { LottieLoader } from '../../components/LottieLoader';
import {
  BAD_MOOD_OPTIONS,
  CHAT_HABIT_OPTIONS,
  DIALOGUE_GUIDE,
  DIALOGUE_INPUT_PLACEHOLDER,
  DIALOGUE_MAX_TURNS,
  DIALOGUE_MIN_TURNS,
  DIALOGUE_PROMPT_CHIPS,
  FRIEND_ROLE_OPTIONS,
  GOAL_OPTIONS,
  GROUP_ROLE_OPTIONS,
  HAPPY_EXPRESSION_OPTIONS,
  INTEREST_PRESETS,
  MODULE_META,
  OCCUPATION_OPTIONS,
  OPINION_PROBES,
  RELATIONSHIP_DEALBREAKER_PROMPT,
  STYLE_SCENARIOS,
  TONE_OPTIONS,
  VALUES_QUESTIONS,
  type ModuleId,
} from './surveySteps';
import { COPY } from '../../copy';

// ---------- 模块子步骤数 ----------
const M1_SUBS = 6; // basics / selfDesc / daily / interests / experience / social
const M2_SUBS = 6; // tones / style / freeWriting / catchphrases / chatHabits / emotion
const M3_SUBS = 6; // values / trust / happiness / opinions / changedMind / signals

const FINALIZE_MIN_MS = 5000;

type FinalizePhase = 'idle' | 'pending' | 'running' | 'done' | 'error';

type FinalizeResponse = {
  cloneId?: string;
  onboardingComplete?: boolean;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
};

type TonePick = { tag: string; evidence: string };

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  // ---------- 模块导航 ----------
  const [moduleIndex, setModuleIndex] = useState(0); // 0..MODULE_META.length-1
  const [sub, setSub] = useState(0); // 模块内子步骤
  const moduleMeta = MODULE_META[moduleIndex];
  const moduleId: ModuleId = moduleMeta.id;

  // ---------- M1: 身份基座 ----------
  const [displayName, setDisplayName] = useState('Echo 用户');
  const [city, setCity] = useState('');
  const [goal, setGoal] = useState<string>(GOAL_OPTIONS[0]);
  const [occupation, setOccupation] = useState('');
  const [selfDescription, setSelfDescription] = useState('');
  const [dailyRoutine, setDailyRoutine] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [interestContexts, setInterestContexts] = useState<Record<string, string>>({});
  const [keyExperience, setKeyExperience] = useState('');
  const [strangerComfort, setStrangerComfort] = useState(50);
  const [friendRole, setFriendRole] = useState('');
  const [groupRole, setGroupRole] = useState('');

  // ---------- M2: 语言指纹 ----------
  const [styleIdx, setStyleIdx] = useState(0);
  const [stylePicks, setStylePicks] = useState<Record<string, string>>({});
  const [styleRelation, setStyleRelation] = useState<Record<string, string>>({});
  const [tonePicks, setTonePicks] = useState<TonePick[]>([]);
  const [freeWritingSample, setFreeWritingSample] = useState('');
  const [catchphrases, setCatchphrases] = useState<string[]>(['', '', '']);
  const [chatHabits, setChatHabits] = useState<Record<string, boolean>>({});
  const [badMoodNeed, setBadMoodNeed] = useState('');
  const [happyExpression, setHappyExpression] = useState('');

  // ---------- M3: 信念系统 ----------
  const [valuesPicks, setValuesPicks] = useState<Record<string, string>>({});
  const [valuesWhy, setValuesWhy] = useState<Record<string, string>>({});
  const [relationshipDealbreaker, setRelationshipDealbreaker] = useState('');
  const [trustView, setTrustView] = useState('');
  const [happinessView, setHappinessView] = useState('');
  const [opinionPicks, setOpinionPicks] = useState<Record<string, string>>({});
  const [opinionWhy, setOpinionWhy] = useState<Record<string, string>>({});
  const [changedMind, setChangedMind] = useState('');
  const [feelingHeardSignal, setFeelingHeardSignal] = useState('');
  const [shutDownTrigger, setShutDownTrigger] = useState('');

  // ---------- M4: 深度对话 + finalize ----------
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [dialogueInput, setDialogueInput] = useState('');
  const [dialogueLog, setDialogueLog] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [dialogueTurns, setDialogueTurns] = useState(0);
  const [dialogueReady, setDialogueReady] = useState(false);
  const [dialogueSending, setDialogueSending] = useState(false);
  const [dialogueError, setDialogueError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [finalizePhase, setFinalizePhase] = useState<FinalizePhase>('idle');
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [minDelayDone, setMinDelayDone] = useState(false);
  const finalizeStartedAtRef = useRef<number | null>(null);
  const finalizeRanRef = useRef(false);

  const hasApi = Boolean(getApiBaseUrl());

  const DIALOGUE_ASSISTANT_FALLBACK =
    '能再用你自己的话说说吗？比如最近一件让你觉得「这就是我」的小事，或者别人说什么会让你突然不想聊了～';

  // ---------- 构造四层问卷 payload ----------
  const surveyPayload = useMemo(() => {
    const styleReplies = STYLE_SCENARIOS.map((s) => {
      const choiceId = stylePicks[s.id] ?? '';
      const choice = s.choices.find((c) => c.id === choiceId);
      return {
        scenarioId: s.id,
        choiceId,
        text: choice?.text ?? '',
        relationContext: styleRelation[s.id]?.trim() || undefined,
      };
    });
    // comfort 场景的关系追问回答同时作为 caringStyle
    const caringStyle = styleRelation['comfort']?.trim() || undefined;
    const toneTags = tonePicks.filter((t) => t.tag).map((t) => ({
      tag: t.tag,
      evidence: t.evidence.trim() || undefined,
    }));
    const catchList = catchphrases.map((c) => c.trim()).filter(Boolean);
    const valuesChoices = VALUES_QUESTIONS.map((q) => {
      const choiceId = valuesPicks[q.id] ?? '';
      const choice = q.choices.find((c) => c.id === choiceId);
      return { questionId: q.id, choiceId, label: choice?.label ?? '' };
    });
    const valuesWhyClean: Record<string, string> = {};
    Object.keys(valuesWhy).forEach((k) => {
      const v = valuesWhy[k];
      if (typeof v === 'string' && v.trim()) valuesWhyClean[k] = v.trim();
    });
    const opinionProbes = OPINION_PROBES.map((q) => {
      const choiceId = opinionPicks[q.id] ?? '';
      const choice = q.choices.find((c) => c.id === choiceId);
      return {
        questionId: q.id,
        choiceId: choiceId || undefined,
        label: choice?.label ?? '',
        reason: opinionWhy[q.id]?.trim() || undefined,
      };
    });
    const chatHabitsObj = {
      usesPunctuation: chatHabits.usesPunctuation ?? false,
      likesEmoji: chatHabits.likesEmoji ?? false,
      prefersShortMessages: chatHabits.prefersShortMessages ?? false,
      sendsVoiceMessages: chatHabits.sendsVoiceMessages ?? false,
    };
    return {
      displayName,
      city,
      goal,
      interests,
      occupation: occupation.trim() || undefined,
      selfDescription: selfDescription.trim() || undefined,
      dailyRoutine: dailyRoutine.trim() || undefined,
      interestContexts: Object.keys(interestContexts).length ? interestContexts : undefined,
      keyExperience: keyExperience.trim() || undefined,
      socialSpectrum: {
        strangerComfort,
        friendRole: friendRole || undefined,
        groupRole: groupRole || undefined,
      },
      styleReplies,
      toneTags,
      freeWritingSample: freeWritingSample.trim() || undefined,
      catchphrases: catchList.length ? catchList : undefined,
      chatHabits: chatHabitsObj,
      emotionalPatterns: {
        badMoodNeed: badMoodNeed || undefined,
        happyExpression: happyExpression || undefined,
      },
      caringStyle,
      valuesChoices,
      valuesWhy: Object.keys(valuesWhyClean).length ? valuesWhyClean : undefined,
      trustView: trustView.trim() || undefined,
      happinessView: happinessView.trim() || undefined,
      opinionProbes,
      changedMind: changedMind.trim() || undefined,
      feelingHeardSignal: feelingHeardSignal.trim() || undefined,
      shutDownTrigger: shutDownTrigger.trim() || undefined,
      extra: relationshipDealbreaker.trim()
        ? { relationshipDealbreaker: relationshipDealbreaker.trim() }
        : undefined,
    };
  }, [
    displayName, city, goal, interests, occupation, selfDescription, dailyRoutine,
    interestContexts, keyExperience, strangerComfort, friendRole, groupRole,
    stylePicks, styleRelation, tonePicks, freeWritingSample, catchphrases, chatHabits,
    badMoodNeed, happyExpression, valuesPicks, valuesWhy, trustView, happinessView,
    opinionPicks, opinionWhy, changedMind, feelingHeardSignal, shutDownTrigger,
    relationshipDealbreaker,
  ]);

  const dialogueTurnsDisplay = Math.min(dialogueTurns, DIALOGUE_MAX_TURNS);
  const dialogueAtMax = dialogueTurns >= DIALOGUE_MAX_TURNS;

  // ---------- 交互辅助 ----------
  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 4 ? [...prev, tag] : prev,
    );
  };

  const toggleTone = (tag: string) => {
    setTonePicks((prev) => {
      const exists = prev.find((t) => t.tag === tag);
      if (exists) return prev.filter((t) => t.tag !== tag);
      if (prev.length >= 3) return prev;
      return [...prev, { tag, evidence: '' }];
    });
  };

  const setToneEvidence = (tag: string, evidence: string) => {
    setTonePicks((prev) => prev.map((t) => (t.tag === tag ? { ...t, evidence } : t)));
  };

  const toggleChatHabit = (id: string) => {
    setChatHabits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const submitSurvey = async () => {
    if (!hasApi) return;
    const res = unwrap(
      await apiPostJson<typeof surveyPayload, { sessionId?: string }>(
        '/onboarding/survey',
        surveyPayload,
      ),
    );
    if (res?.sessionId) setSessionId(res.sessionId);
  };

  // ---------- M4 对话 ----------
  const resetDialogueSession = async (): Promise<boolean> => {
    if (!hasApi) {
      setDialogueLog([
        {
          role: 'assistant',
          text:
            '嗨～我会像好奇的采访者一样追问你。先随便聊聊：最近一件让你觉得「今天没白过」的小事是什么？',
        },
      ]);
      setDialogueTurns(0);
      setDialogueReady(true);
      return true;
    }
    setDialogueError(null);
    const res = unwrap(
      await apiPostJson<
        { sessionId?: string },
        { sessionId?: string; turnCount?: number; history?: { role: 'user' | 'assistant'; text: string }[] }
      >('/onboarding/dialogue/start', { sessionId }),
    );
    if (!res?.sessionId) {
      setDialogueReady(false);
      setDialogueError(COPY.error.dialogueInit);
      return false;
    }
    setSessionId(res.sessionId);
    setDialogueLog((res.history ?? []).map((m) => ({ role: m.role, text: m.text })));
    setDialogueTurns(Math.min(DIALOGUE_MAX_TURNS, res.turnCount ?? 0));
    setDialogueInput('');
    setDialogueReady(true);
    return true;
  };

  const sendDialogue = async () => {
    if (!dialogueInput.trim() || dialogueAtMax || dialogueSending) return;
    if (hasApi && !dialogueReady) return;
    const msg = dialogueInput.trim();
    setDialogueInput('');
    setDialogueError(null);
    setDialogueLog((prev) => [...prev, { role: 'user', text: msg }]);
    setDialogueSending(true);
    try {
      if (hasApi) {
        const res = unwrap(
          await apiPostJson<
            { message: string; sessionId?: string },
            { reply?: string; sessionId?: string; turnCount?: number; maxReached?: boolean }
          >('/onboarding/dialogue/turn', { message: msg, sessionId }),
        );
        if (!res) {
          setDialogueError(COPY.error.dialogueSendFailed);
          return;
        }
        if (res.sessionId) setSessionId(res.sessionId);
        const assistantText = res.reply?.trim() || DIALOGUE_ASSISTANT_FALLBACK;
        setDialogueLog((prev) => [...prev, { role: 'assistant', text: assistantText }]);
        const nextTurns = Math.min(DIALOGUE_MAX_TURNS, res.turnCount ?? dialogueTurns + 1);
        setDialogueTurns(nextTurns);
      } else {
        setDialogueLog((prev) => [
          ...prev,
          { role: 'assistant', text: '谢谢分享，这点我记下了。那再追问一个：你刚说的，有没有例外的时候？' },
        ]);
        setDialogueTurns((t) => Math.min(DIALOGUE_MAX_TURNS, t + 1));
      }
    } finally {
      setDialogueSending(false);
    }
  };

  const handleDialogueKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!dialogueSending && dialogueInput.trim() && !dialogueAtMax && dialogueReady) {
        void sendDialogue();
      }
    }
  };

  const runFinalize = useCallback(async () => {
    setFinalizePhase('running');
    setFinalizeError(null);
    setMinDelayDone(false);
    finalizeStartedAtRef.current = Date.now();

    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, FINALIZE_MIN_MS));

    const work = async (): Promise<boolean> => {
      if (hasApi) {
        const res = unwrap(
          await apiPostJson<Record<string, never>, FinalizeResponse>('/onboarding/finalize', {}),
        );
        if (!res?.onboardingComplete) {
          setFinalizeError(COPY.error.finalize);
          return false;
        }
        if (res.accessToken && res.userId) {
          saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken, userId: res.userId });
          scheduleProactiveRefresh();
        }
        return true;
      }
      await new Promise((r) => setTimeout(r, FINALIZE_MIN_MS));
      return true;
    };

    const [ok] = await Promise.all([work(), minDelay]);
    setMinDelayDone(true);
    if (ok) setFinalizePhase('done');
    else setFinalizePhase('error');
  }, [hasApi]);

  // 进入对话模块时初始化
  useEffect(() => {
    if (moduleId !== 'm4') {
      setDialogueReady(false);
      setDialogueError(null);
      return;
    }
    if (!hasApi) {
      setDialogueReady(true);
      return;
    }
    if (dialogueReady) return;
    void resetDialogueSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, hasApi, dialogueReady]);

  // 进入 finalize 模块时触发孵化
  useEffect(() => {
    if (moduleId !== 'finalize') {
      finalizeRanRef.current = false;
      return;
    }
    if (finalizePhase !== 'pending' || finalizeRanRef.current) return;
    finalizeRanRef.current = true;
    void runFinalize();
  }, [moduleId, finalizePhase, runFinalize]);

  // ---------- 步骤推进逻辑 ----------
  const subTotal = moduleId === 'm1' ? M1_SUBS : moduleId === 'm2' ? M2_SUBS : moduleId === 'm3' ? M3_SUBS : 1;

  const canNext = (): boolean => {
    switch (moduleId) {
      case 'm1':
        switch (sub) {
          case 0: return city.trim().length > 0; // basics
          case 1: return true; // selfDesc 可选
          case 2: return true; // daily 可选
          case 3: return interests.length >= 1; // interests
          case 4: return true; // experience 可选
          case 5: return true; // social 可选
          default: return true;
        }
      case 'm2':
        switch (sub) {
          case 0: return tonePicks.length >= 2; // tones
          case 1: return !!stylePicks[STYLE_SCENARIOS[styleIdx].id]; // style 当前场景已选
          case 2: return true; // freeWriting 可选
          case 3: return true; // catchphrases 可选
          case 4: return true; // chatHabits 可选
          case 5: return true; // emotion 可选
          default: return true;
        }
      case 'm3':
        switch (sub) {
          case 0: return VALUES_QUESTIONS.every((q) => valuesPicks[q.id]); // values
          case 1: return true; // trust 可选
          case 2: return true; // happiness 可选
          case 3: return OPINION_PROBES.every((q) => opinionPicks[q.id]); // opinions
          case 4: return true; // changedMind 可选
          case 5: return true; // signals 可选
          default: return true;
        }
      case 'consent':
        return true;
      case 'm4':
        return dialogueTurns >= DIALOGUE_MIN_TURNS;
      case 'finalize':
        return finalizePhase === 'done' && minDelayDone;
      default:
        return true;
    }
  };

  const next = async () => {
    // finalize 模块特殊处理
    if (moduleId === 'finalize') {
      if (finalizePhase === 'error') {
        setFinalizePhase('pending');
        finalizeRanRef.current = false;
        return;
      }
      if (finalizePhase === 'done' && minDelayDone) onComplete();
      return;
    }

    // 对话模块：若有未发送输入，先发送
    if (moduleId === 'm4' && dialogueInput.trim()) {
      await sendDialogue();
      return;
    }

    // M2 style 子步骤：内部循环 6 场景
    if (moduleId === 'm2' && sub === 1) {
      if (styleIdx < STYLE_SCENARIOS.length - 1) {
        setStyleIdx(styleIdx + 1);
        return;
      }
    }

    // 子步骤推进
    if (sub < subTotal - 1) {
      setSub(sub + 1);
      return;
    }

    // 模块结束 → 进入下一模块
    // M3 结束（进入 consent 前）提交问卷
    if (moduleId === 'm3') {
      setLoading(true);
      await submitSurvey();
      setLoading(false);
    }

    // 进入对话模块前重置 styleIdx / sub，并预初始化对话
    const nextModuleIndex = moduleIndex + 1;
    setSub(0);
    setStyleIdx(0);
    if (MODULE_META[nextModuleIndex]?.id === 'm4') {
      setLoading(true);
      const ok = await resetDialogueSession();
      setLoading(false);
      if (!ok) return;
    }
    if (MODULE_META[nextModuleIndex]?.id === 'finalize') {
      setFinalizePhase('pending');
      finalizeRanRef.current = false;
    }
    setModuleIndex(nextModuleIndex);
  };

  // ---------- 主按钮文案/状态 ----------
  const primaryLabel = (): string => {
    if (moduleId === 'finalize') {
      if (finalizePhase === 'error') return COPY.btn.retryHatch;
      if (finalizePhase === 'done' && minDelayDone) return COPY.btn.doneGoToPlaza;
      return COPY.loading.finalize;
    }
    if (moduleId === 'm2' && sub === 1 && styleIdx < STYLE_SCENARIOS.length - 1) {
      return '下一题';
    }
    return '继续';
  };

  const primaryDisabled =
    moduleId === 'finalize'
      ? finalizePhase === 'running' ||
        (finalizePhase === 'done' && !minDelayDone) ||
        (finalizePhase !== 'done' && finalizePhase !== 'error')
      : !canNext() || loading || (moduleId === 'm4' && !dialogueReady);

  const primaryClassName =
    moduleId === 'finalize' && (finalizePhase === 'running' || (finalizePhase === 'done' && !minDelayDone))
      ? 'mt-8 w-full bg-white/15 text-gray-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed'
      : 'mt-8 w-full bg-echo-blue text-echo-dark font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40';

  // 子步骤标题
  const subTitle = (): string => {
    if (moduleId === 'm1') {
      return ['基础画像', '朋友眼中的你', '典型一天', '兴趣与热爱', '改变你的经历', '社交角色'][sub] ?? '';
    }
    if (moduleId === 'm2') {
      if (sub === 1) return `语言场景 ${styleIdx + 1}/${STYLE_SCENARIOS.length}`;
      return ['语气标签', '', '自由写作', '口头禅', '聊天习惯', '情绪反应'][sub] ?? '';
    }
    if (moduleId === 'm3') {
      return ['关系与分歧', '信任观', '幸福观', '日常观点', '改变过想法', '边界与信号'][sub] ?? '';
    }
    return moduleMeta.title;
  };

  const inputCls = 'w-full bg-echo-card border border-white/10 rounded-xl px-3 py-2 text-sm';
  const cardBtn = (active: boolean) =>
    `w-full text-left p-3 rounded-xl border text-sm ${active ? 'border-echo-blue bg-echo-blue/10' : 'border-white/10 bg-echo-card'}`;
  const tagBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs border ${active ? 'bg-echo-blue/20 border-echo-blue text-echo-blue' : 'border-white/10 text-gray-400'}`;

  return (
    <div className="min-h-screen bg-echo-dark flex flex-col p-6 justify-center max-w-md mx-auto">
      {/* 模块级进度 */}
      <div className="mb-6">
        <div className="bg-white/5 h-1 w-full rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-echo-blue"
            animate={{ width: `${((moduleIndex + 1) / MODULE_META.length) * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-500 mt-2 text-center">
          模块 {moduleIndex + 1}/{MODULE_META.length} · {moduleMeta.title}
          {(moduleId === 'm1' || moduleId === 'm2' || moduleId === 'm3') && (
            <> · 步骤 {sub + 1}/{subTotal} {subTitle() && `· ${subTitle()}`}</>
          )}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${moduleId}-${sub}-${styleIdx}`}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          className="flex-1 flex flex-col"
        >
          {/* ==================== M1 身份基座 ==================== */}
          {moduleId === 'm1' && sub === 0 && (
            <div className="space-y-4 text-left w-full">
              <h2 className="text-xl font-bold text-center mb-1">基础画像</h2>
              <p className="text-xs text-gray-500 text-center mb-2">让分身知道你是谁、在哪里、做什么。</p>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="昵称" className={inputCls} />
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="城市，如：上海" className={inputCls} />
              <select value={goal} onChange={(e) => setGoal(e.target.value)} className={inputCls}>
                {GOAL_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select value={occupation} onChange={(e) => setOccupation(e.target.value)} className={inputCls}>
                <option value="">职业 / 领域（选一个）</option>
                {OCCUPATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}

          {moduleId === 'm1' && sub === 1 && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-2">朋友们怎么形容你？</h2>
              <p className="text-xs text-gray-500 mb-3">用 3 个词 + 一句理由。这是你社交人格的锚点。（可选）</p>
              <textarea value={selfDescription} onChange={(e) => setSelfDescription(e.target.value)} placeholder="比如：直接、靠谱、有点轴——朋友说我答应的事就一定办到" rows={3} className={`${inputCls} resize-y`} />
            </div>
          )}

          {moduleId === 'm1' && sub === 2 && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-2">你的典型一天</h2>
              <p className="text-xs text-gray-500 mb-3">随便说几个片段就行，比如"早上咖啡，晚上打球"。（可选）</p>
              <textarea value={dailyRoutine} onChange={(e) => setDailyRoutine(e.target.value)} placeholder="比如：早上挤地铁刷手机，午休遛弯，晚上瘫着看剧" rows={3} className={`${inputCls} resize-y`} />
            </div>
          )}

          {moduleId === 'm1' && sub === 3 && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-2">兴趣与热爱</h2>
              <p className="text-xs text-gray-500 mb-3">选 1–4 个，选完可以补一句"为什么"。</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {INTEREST_PRESETS.map((t) => (
                  <button key={t} type="button" onClick={() => toggleInterest(t)} className={tagBtn(interests.includes(t))}>{t}</button>
                ))}
              </div>
              {interests.length > 0 && (
                <div className="space-y-2">
                  {interests.map((i) => (
                    <div key={i}>
                      <p className="text-[11px] text-gray-400 mb-1">关于「{i}」——你最近因为它感到充实的一次是？</p>
                      <input
                        value={interestContexts[i] ?? ''}
                        onChange={(e) => setInterestContexts((p) => ({ ...p, [i]: e.target.value }))}
                        placeholder="可选，一句话就行"
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {moduleId === 'm1' && sub === 4 && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-2">一个改变了你的经历</h2>
              <p className="text-xs text-gray-500 mb-3">不一定要很重大，改变了你想法的一件小事也行。（可选）</p>
              <textarea value={keyExperience} onChange={(e) => setKeyExperience(e.target.value)} placeholder="比如：有次被同事当面指出我的问题，当时很气，后来反而感谢他" rows={4} className={`${inputCls} resize-y`} />
            </div>
          )}

          {moduleId === 'm1' && sub === 5 && (
            <div className="text-left w-full space-y-5">
              <div>
                <h2 className="text-lg font-bold mb-1">社交角色</h2>
                <p className="text-xs text-gray-500 mb-3">让分身知道你在不同场合的定位。</p>
              </div>
              <div>
                <p className="text-sm mb-2">和陌生人：拘谨 ←→ 自来熟</p>
                <input type="range" min={0} max={100} value={strangerComfort} onChange={(e) => setStrangerComfort(Number(e.target.value))} className="w-full accent-echo-blue" />
                <div className="flex justify-between text-[10px] text-gray-500"><span>拘谨</span><span>自来熟</span></div>
              </div>
              <div>
                <p className="text-sm mb-2">和朋友时，你更像：</p>
                <div className="flex flex-wrap gap-2">
                  {FRIEND_ROLE_OPTIONS.map((r) => (
                    <button key={r} type="button" onClick={() => setFriendRole(r)} className={tagBtn(friendRole === r)}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm mb-2">在群体中，你通常是：</p>
                <div className="flex flex-wrap gap-2">
                  {GROUP_ROLE_OPTIONS.map((r) => (
                    <button key={r} type="button" onClick={() => setGroupRole(r)} className={tagBtn(groupRole === r)}>{r}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================== M2 语言指纹 ==================== */}
          {moduleId === 'm2' && sub === 0 && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-1">选 2–3 个语气词</h2>
              <p className="text-xs text-gray-500 mb-3">选完后，给每个词配一句你真实的原话当证据。</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTone(t)}
                    className={`px-4 py-2 rounded-full text-sm font-bold ${tonePicks.some((p) => p.tag === t) ? 'bg-echo-blue text-echo-dark' : 'bg-white/5 text-gray-400'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tonePicks.length > 0 && (
                <div className="space-y-2">
                  {tonePicks.map((p) => (
                    <div key={p.tag}>
                      <p className="text-[11px] text-gray-400 mb-1">「{p.tag}」——你经常说的一句话是？</p>
                      <input
                        value={p.evidence}
                        onChange={(e) => setToneEvidence(p.tag, e.target.value)}
                        placeholder="可选，举个例子"
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {moduleId === 'm2' && sub === 1 && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-2">{STYLE_SCENARIOS[styleIdx].prompt}</h2>
              <div className="space-y-2 mb-4">
                {STYLE_SCENARIOS[styleIdx].choices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setStylePicks((p) => ({ ...p, [STYLE_SCENARIOS[styleIdx].id]: c.id }))}
                    className={cardBtn(stylePicks[STYLE_SCENARIOS[styleIdx].id] === c.id)}
                  >
                    {c.text}
                  </button>
                ))}
              </div>
              {STYLE_SCENARIOS[styleIdx].relationFollowup && (
                <>
                  <p className="text-[11px] text-gray-400 mb-1">{STYLE_SCENARIOS[styleIdx].relationFollowup}</p>
                  <textarea
                    value={styleRelation[STYLE_SCENARIOS[styleIdx].id] ?? ''}
                    onChange={(e) => setStyleRelation((p) => ({ ...p, [STYLE_SCENARIOS[styleIdx].id]: e.target.value }))}
                    placeholder="可选，一两句就行"
                    rows={2}
                    className={`${inputCls} resize-y`}
                  />
                </>
              )}
            </div>
          )}

          {moduleId === 'm2' && sub === 2 && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-2">给最好的朋友发条消息</h2>
              <p className="text-xs text-gray-500 mb-3">用你平时说话的口吻，吐槽或分享今天发生的某件小事。这是最重要的语言样本。（可选，≥20 字更佳）</p>
              <textarea value={freeWritingSample} onChange={(e) => setFreeWritingSample(e.target.value)} placeholder="比如：笑死 今天地铁上那个大叔非说我是他老乡 我都懵了 你说我是不是长了张老乡脸" rows={4} className={`${inputCls} resize-y`} />
            </div>
          )}

          {moduleId === 'm2' && sub === 3 && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-2">你的口头禅</h2>
              <p className="text-xs text-gray-500 mb-3">那些你经常说、朋友一听就知道是你的话，写 3 句。（可选）</p>
              <div className="space-y-2">
                {catchphrases.map((c, i) => (
                  <input
                    key={i}
                    value={c}
                    onChange={(e) => setCatchphrases((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                    placeholder={i === 0 ? '比如：笑死' : i === 1 ? '比如：那确实' : '比如：不是我说'}
                    className={inputCls}
                  />
                ))}
              </div>
            </div>
          )}

          {moduleId === 'm2' && sub === 4 && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-2">聊天习惯</h2>
              <p className="text-xs text-gray-500 mb-3">平时打字是哪种感觉？（多选，可选）</p>
              <div className="flex flex-wrap gap-2">
                {CHAT_HABIT_OPTIONS.map((h) => (
                  <button key={h.id} type="button" onClick={() => toggleChatHabit(h.id)} className={tagBtn(!!chatHabits[h.id])}>{h.label}</button>
                ))}
              </div>
            </div>
          )}

          {moduleId === 'm2' && sub === 5 && (
            <div className="text-left w-full space-y-5">
              <div>
                <h2 className="text-lg font-bold mb-1">情绪反应</h2>
                <p className="text-xs text-gray-500">让分身知道你低落和开心时想要什么。（可选）</p>
              </div>
              <div>
                <p className="text-sm mb-2">心情不好时，你希望别人：</p>
                <div className="flex flex-wrap gap-2">
                  {BAD_MOOD_OPTIONS.map((o) => (
                    <button key={o} type="button" onClick={() => setBadMoodNeed(o)} className={tagBtn(badMoodNeed === o)}>{o}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm mb-2">特别开心时，你会：</p>
                <div className="flex flex-wrap gap-2">
                  {HAPPY_EXPRESSION_OPTIONS.map((o) => (
                    <button key={o} type="button" onClick={() => setHappyExpression(o)} className={tagBtn(happyExpression === o)}>{o}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================== M3 信念系统 ==================== */}
          {moduleId === 'm3' && sub === 0 && (
            <div className="space-y-6 text-left w-full">
              {VALUES_QUESTIONS.map((q) => (
                <div key={q.id}>
                  <p className="text-sm font-bold mb-2">{q.prompt}</p>
                  <div className="space-y-2 mb-2">
                    {q.choices.map((c) => (
                      <button key={c.id} type="button" onClick={() => setValuesPicks((p) => ({ ...p, [q.id]: c.id }))} className={cardBtn(valuesPicks[q.id] === c.id)}>{c.label}</button>
                    ))}
                  </div>
                  <input
                    value={valuesWhy[q.id] ?? ''}
                    onChange={(e) => setValuesWhy((p) => ({ ...p, [q.id]: e.target.value }))}
                    placeholder={q.whyPrompt}
                    className={inputCls}
                  />
                </div>
              ))}
              <div>
                <p className="text-sm font-bold mb-2">{RELATIONSHIP_DEALBREAKER_PROMPT}</p>
                <input value={relationshipDealbreaker} onChange={(e) => setRelationshipDealbreaker(e.target.value)} placeholder="比如：冷暴力、说谎" className={inputCls} />
              </div>
            </div>
          )}

          {moduleId === 'm3' && sub === 1 && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-2">你一般怎么判断一个人是否值得信任？</h2>
              <p className="text-xs text-gray-500 mb-3">这是你最底层的社交判断逻辑。（可选）</p>
              <textarea value={trustView} onChange={(e) => setTrustView(e.target.value)} placeholder="比如：看小事——答应的能不能做到，做不到会不会主动说" rows={3} className={`${inputCls} resize-y`} />
            </div>
          )}

          {moduleId === 'm3' && sub === 2 && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-2">什么让你真正感到开心？</h2>
              <p className="text-xs text-gray-500 mb-3">不是标准答案，说个具体的。（可选）</p>
              <textarea value={happinessView} onChange={(e) => setHappinessView(e.target.value)} placeholder="比如：和懂的人聊天聊通；一个人做完一件难事" rows={3} className={`${inputCls} resize-y`} />
            </div>
          )}

          {moduleId === 'm3' && sub === 3 && (
            <div className="space-y-5 text-left w-full">
              <h2 className="text-lg font-bold">日常观点</h2>
              {OPINION_PROBES.map((q) => (
                <div key={q.id}>
                  <p className="text-sm mb-2">{q.prompt}</p>
                  <div className="space-y-2 mb-2">
                    {q.choices.map((c) => (
                      <button key={c.id} type="button" onClick={() => setOpinionPicks((p) => ({ ...p, [q.id]: c.id }))} className={cardBtn(opinionPicks[q.id] === c.id)}>{c.label}</button>
                    ))}
                  </div>
                  <input
                    value={opinionWhy[q.id] ?? ''}
                    onChange={(e) => setOpinionWhy((p) => ({ ...p, [q.id]: e.target.value }))}
                    placeholder={q.whyPrompt}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          )}

          {moduleId === 'm3' && sub === 4 && (
            <div className="text-left w-full">
              <h2 className="text-lg font-bold mb-2">你改变过想法的一件事</h2>
              <p className="text-xs text-gray-500 mb-3">愿意改变想法本身就是重要的人格特征。（可选）</p>
              <textarea value={changedMind} onChange={(e) => setChangedMind(e.target.value)} placeholder="比如：以前觉得内向是缺点，现在觉得只是另一种能量管理方式" rows={3} className={`${inputCls} resize-y`} />
            </div>
          )}

          {moduleId === 'm3' && sub === 5 && (
            <div className="space-y-5 text-left w-full">
              <div>
                <h2 className="text-lg font-bold mb-1">边界与信号</h2>
                <p className="text-xs text-gray-500">让分身知道什么让你被理解、什么让你闭嘴。</p>
              </div>
              <div>
                <p className="text-sm mb-2">别人怎么做/怎么说，会让你觉得「他懂我」？</p>
                <textarea value={feelingHeardSignal} onChange={(e) => setFeelingHeardSignal(e.target.value)} placeholder="比如：不急着给建议，先复述我的感受" rows={2} className={`${inputCls} resize-y`} />
              </div>
              <div>
                <p className="text-sm mb-2">别人说什么/做什么，会让你突然不想聊了？</p>
                <textarea value={shutDownTrigger} onChange={(e) => setShutDownTrigger(e.target.value)} placeholder="比如：上来就评价我；用说教语气" rows={2} className={`${inputCls} resize-y`} />
              </div>
            </div>
          )}

          {/* ==================== consent ==================== */}
          {moduleId === 'consent' && (
            <div className="text-center">
              <ShieldCheck className="w-12 h-12 text-echo-blue mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">分身授权书</h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                我授权 Echo 利用四层问卷与深度对话数据生成数字分身，在广场及私聊中代表我进行初步互动，并保留 Handoff 否决权。
              </p>
            </div>
          )}

          {/* ==================== M4 深度对话 ==================== */}
          {moduleId === 'm4' && (
            <div className="w-full flex flex-col min-h-[280px]">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="w-5 h-5 text-echo-blue shrink-0" />
                <h2 className="font-bold">深度对话：补盲区、捕捉矛盾</h2>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                建议 8–10 轮，最少 {DIALOGUE_MIN_TURNS}、最多 {DIALOGUE_MAX_TURNS} 轮（当前 {dialogueTurnsDisplay} / {DIALOGUE_MAX_TURNS}）
              </p>
              <p className="text-xs text-gray-400 leading-relaxed mb-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                {DIALOGUE_GUIDE}
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {DIALOGUE_PROMPT_CHIPS.map((chip) => (
                  <button key={chip} type="button" disabled={dialogueAtMax || dialogueSending || !dialogueReady} onClick={() => setDialogueInput(chip)} className="text-[11px] px-2.5 py-1.5 rounded-full border border-white/15 text-gray-400 hover:border-echo-blue/40 hover:text-echo-blue disabled:opacity-40">
                    {chip}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 mb-3 max-h-48">
                {dialogueLog.map((m, i) => (
                  <p key={i} className={`text-xs p-2 rounded-lg whitespace-pre-wrap break-words ${m.role === 'user' ? 'bg-echo-blue/10 ml-4' : 'bg-white/5 mr-4'}`}>
                    {m.role === 'user' ? '你' : '助手'}：{m.text}
                  </p>
                ))}
              </div>
              <textarea value={dialogueInput} onChange={(e) => setDialogueInput(e.target.value)} onKeyDown={handleDialogueKeyDown} placeholder={DIALOGUE_INPUT_PLACEHOLDER} rows={3} disabled={dialogueAtMax || dialogueSending || !dialogueReady} className="w-full bg-echo-card border border-white/10 rounded-xl px-3 py-2.5 text-sm mb-2 resize-y break-words disabled:opacity-50" />
              <button type="button" onClick={() => void sendDialogue()} disabled={dialogueSending || !dialogueReady || !dialogueInput.trim() || dialogueAtMax} className="w-full py-2.5 px-5 rounded-xl bg-echo-blue/20 border border-echo-blue/40 text-echo-blue text-sm font-bold mb-2 disabled:opacity-40">
                发送
              </button>
              {!dialogueReady && hasApi && <p className="text-xs text-gray-500 mb-2">{COPY.loading.dialogueInit}</p>}
              {dialogueError && <p className="text-xs text-amber-400 mb-2">{dialogueError}</p>}
              {dialogueSending && <p className="text-xs text-gray-500 mb-2">{COPY.loading.dialogueTyping}</p>}
              <p className="text-[10px] text-gray-600">
                {dialogueTurns < DIALOGUE_MIN_TURNS
                  ? `至少 ${DIALOGUE_MIN_TURNS} 轮后可继续（当前 ${dialogueTurns} 轮）`
                  : dialogueAtMax
                    ? '聊得不错，你的语气我学会了。点击「继续」去孵化吧 👇'
                    : `已满 ${DIALOGUE_MIN_TURNS} 轮，可随时点击「继续」`}
              </p>
            </div>
          )}

          {/* ==================== finalize ==================== */}
          {moduleId === 'finalize' && (
            <div className="text-center">
              <div className="flex justify-center mb-1">
                <LottieLoader size={480} />
              </div>
              <h2 className="text-xl font-bold">{finalizePhase === 'done' ? COPY.celebrate.finalizeDone : '分身正在孵化'}</h2>
              <p className="text-base font-bold text-gray-300 tracking-wide mt-1">
                {finalizePhase === 'done' ? COPY.celebrate.finalizeLegacy : '正在写入四层人格与语言风格，并排队发布首条广场动态'}
              </p>
              {finalizePhase === 'error' && finalizeError && <p className="text-sm text-red-400 mt-3">{finalizeError}</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <button type="button" disabled={primaryDisabled} onClick={() => void next()} className={primaryClassName}>
        {loading ? COPY.loading.next : primaryLabel()}
        {!(moduleId === 'finalize' && finalizePhase === 'running') && <ArrowRight className="w-5 h-5" />}
      </button>
    </div>
  );
}
