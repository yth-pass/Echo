/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 1 — 18 张情境卡片全屏插画
 * 每卡行为选项 + 可选自由文本 + responseTimeMs 计时
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ArrowLeft, Lightbulb } from 'lucide-react';
import { SCENARIO_CARDS, PERSONA_FRAGMENTS } from './scenario-cards.data';
import { ProgressRing } from './components/ProgressRing';
import { PersonaFragment } from './components/PersonaFragment';
import { submitPhase1, getPhase1Hint } from './onboarding-v2.api';
import { COPY } from '../../../copy';
import type { ApiResult } from '../../../api/client';
import type { Phase1CardResponse, PhaseProps } from './onboarding-v2.types';

const TOTAL_CARDS = SCENARIO_CARDS.length;
const CHECKPOINT_EVERY = 5;

type ApiError = { ok: false; status: number; message: string };

function phase1ErrorMsg(r: ApiResult<unknown>): string {
  if (r.ok) return '';
  const err = r as ApiError;
  if (err.status === 0) return COPY.error.network;
  if (err.status === 401) return COPY.error.loginExpired;
  return err.message || `提交失败 (${err.status})`;
}

export function Phase1Cards({ userId, gender, onComplete, initialError }: PhaseProps & { userId: string; gender?: string }) {
  const [cardIndex, setCardIndex] = useState(0);
  const [responses, setResponses] = useState<Phase1CardResponse[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [showFragment, setShowFragment] = useState(false);
  const [fragmentText, setFragmentText] = useState('');
  const [hintLoading, setHintLoading] = useState(false);
  const cardStartRef = useRef(performance.now());
  const localStorageKey = userId ? `onboarding_phase1_responses_${userId}` : 'onboarding_phase1_responses';

  // 从 localStorage 恢复
  // D3 修复：OnboardingShell 在 mount 时会把后端 phase1Responses 写入同一个 key（跨设备恢复）
  // 恢复时根据 responses.length 智能推断 cardIndex，跳到下一个未答的卡片
  useEffect(() => {
    try {
      const saved = localStorage.getItem(localStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { index: number; responses: Phase1CardResponse[] };
        const restoredResponses = parsed.responses ?? [];
        // 智能推断 cardIndex：优先用 responses.length（跳到下一未答卡），fallback 到 parsed.index
        const inferredIndex = restoredResponses.length > 0
          ? Math.min(restoredResponses.length, TOTAL_CARDS - 1)
          : parsed.index;

        if (inferredIndex >= 0 && inferredIndex < TOTAL_CARDS) {
          setCardIndex(inferredIndex);
          setResponses(restoredResponses);
        } else if (inferredIndex === TOTAL_CARDS && Array.isArray(restoredResponses)) {
          // 所有卡片已完成但提交可能失败 → 停留在最后一张卡，保留 responses 以便重试
          setCardIndex(TOTAL_CARDS - 1);
          setResponses(restoredResponses);
        } else {
          // 过期 / 无效数据，清除
          localStorage.removeItem(localStorageKey);
        }
      }
    } catch {
      // silent
    }
  }, [localStorageKey]);

  const card = SCENARIO_CARDS[cardIndex] ?? SCENARIO_CARDS[0];
  const isUnsentLetter = card?.cardId === 'unsent_letter';

  // 每进入新卡重置计时
  useEffect(() => {
    cardStartRef.current = performance.now();
    setSelectedOption(null);
    setFreeText('');
  }, [cardIndex]);

  // 本地暂存
  const saveCheckpoint = useCallback(
    (idx: number, resps: Phase1CardResponse[]) => {
      try {
        localStorage.setItem(
          localStorageKey,
          JSON.stringify({ index: idx, responses: resps }),
        );
      } catch {
        // silent
      }
    },
    [],
  );

  const canSubmit = useCallback((): boolean => {
    if (isUnsentLetter) {
      return freeText.trim().length > 0 && freeText.length <= card.freeTextMaxLength;
    }
    if (selectedOption === 'custom') {
      return freeText.trim().length > 0;
    }
    return selectedOption != null;
  }, [isUnsentLetter, freeText, selectedOption, card.freeTextMaxLength]);

  const handleSubmitCard = async () => {
    if (!canSubmit()) return;

    const responseTimeMs = Math.round(performance.now() - cardStartRef.current);
    const response: Phase1CardResponse = {
      cardId: card.cardId,
      choice: isUnsentLetter
        ? 'custom'
        : selectedOption === 'custom'
          ? 'custom'
          : (selectedOption as Phase1CardResponse['choice']),
      freeText: freeText.trim() || undefined,
      responseTimeMs,
    };

    const newResponses = [...responses, response];
    setResponses(newResponses);
    saveCheckpoint(cardIndex + 1, newResponses);

    const nextIndex = cardIndex + 1;

    // 每 5 卡揭晓碎片
    if (nextIndex % CHECKPOINT_EVERY === 0 && nextIndex < TOTAL_CARDS) {
      const fragIdx = Math.floor(nextIndex / CHECKPOINT_EVERY) - 1;
      if (fragIdx < PERSONA_FRAGMENTS.length) {
        setFragmentText(PERSONA_FRAGMENTS[fragIdx]);
        setShowFragment(true);
        return; // 等 dismiss 后再推进
      }
    }

    if (nextIndex >= TOTAL_CARDS) {
      // 全部完成 → 提交
      setSubmitting(true);
      setError(null);
      const result = await submitPhase1(newResponses);
      setSubmitting(false);
      if (result.ok) {
        onComplete();
      } else {
        setError(phase1ErrorMsg(result));
      }
    } else {
      setCardIndex(nextIndex);
    }
  };

  const handleFragmentDismiss = () => {
    setShowFragment(false);
    const nextIndex = cardIndex + 1;
    if (nextIndex >= TOTAL_CARDS) {
      setSubmitting(true);
      submitPhase1(responses).then(() => {
        setSubmitting(false);
        onComplete();
      });
    } else {
      setCardIndex(nextIndex);
    }
  };

  // 返回上一题：回退 cardIndex 并恢复之前的答案
  const handleGoBack = () => {
    if (cardIndex <= 0 || showFragment) return;
    const prevIndex = cardIndex - 1;
    // 恢复上一题的答案
    const prevResponse = responses[prevIndex];
    if (prevResponse) {
      if (prevResponse.choice === 'custom') {
        setSelectedOption('custom');
        setFreeText(prevResponse.freeText ?? '');
      } else {
        setSelectedOption(prevResponse.choice);
        setFreeText('');
      }
      // 移除最后一份 response
      setResponses((r) => r.slice(0, -1));
      saveCheckpoint(prevIndex, responses.slice(0, prevIndex));
    } else {
      setSelectedOption(null);
      setFreeText('');
    }
    setCardIndex(prevIndex);
  };

  // AI 灵感提示
  const handleGetHint = async () => {
    if (hintLoading) return;
    setHintLoading(true);
    const hint = await getPhase1Hint(card.cardId);
    setHintLoading(false);
    if (hint) {
      setFreeText(hint);
      if (isUnsentLetter) return; // 纯文本卡直接填入
      setSelectedOption('custom'); // 选择"自己写"模式
    }
  };

  // 该卡片是否有开放文本（可填入 AI 提示）
  const hasFreeTextInput = isUnsentLetter || card.allowCustomText;

  // 插画占位渐变色（图片加载前的 fallback）
  const gradients = [
    'from-emerald-900/40 to-teal-800/20',
    'from-violet-900/40 to-purple-800/20',
    'from-amber-900/40 to-orange-800/20',
    'from-rose-900/40 to-pink-800/20',
    'from-sky-900/40 to-blue-800/20',
    'from-fuchsia-900/40 to-purple-800/20',
    'from-lime-900/40 to-green-800/20',
    'from-cyan-900/40 to-teal-800/20',
    'from-red-900/40 to-rose-800/20',
    'from-indigo-900/40 to-violet-800/20',
    'from-yellow-900/40 to-amber-800/20',
    'from-stone-900/40 to-zinc-800/20',
    'from-teal-900/40 to-emerald-800/20',
    'from-blue-900/40 to-indigo-800/20',
    'from-neutral-900/40 to-gray-800/20',
    'from-pink-900/40 to-rose-800/20',
    'from-indigo-900/40 to-sky-800/20',
    'from-orange-900/40 to-amber-800/20',
  ];

  // 每张卡片对应的插画文件名（Q1=第1题 … Q18=第18题）— 男性版
  const illustrationFilesMale = [
    'Q1_forest.png',
    'Q2_ticket.png',
    'Q3_box.png',
    'Q4.png',
    'Q5_weekend.png',
    'Q6_train.png',
    'Q7.png',
    'Q8_ddl.png',
    'Q9.png',
    'Q10.png',
    'Q11.png',
    'Q12.png',
    'Q13.png',
    'Q14.png',
    'Q15.png',
    'Q16_breakfast.png',
    'Q17_silent.png',
    'Q18_song.png',
  ];

  // 女性版插画（存放在 /illustrations/female/ 子目录）
  const illustrationFilesFemale = [
    'female/Q1_forest.png',
    'female/Q2_ticket.png',
    'female/Q3_box.png',
    'female/Q4.png',
    'female/Q5_weekend.png',
    'female/Q6_train.png',
    'female/Q7.png',
    'female/Q8_ddl.png',
    'female/Q9.png',
    'female/Q10.png',
    'female/Q11.png',
    'female/Q12.png',
    'female/Q13.png',
    'female/Q14.png',
    'female/Q15.png',
    'female/Q16_breakfast.png',
    'female/Q17_silent.png',
    'female/Q18_song.png',
  ];

  const illustrationFiles = gender === 'female' ? illustrationFilesFemale : illustrationFilesMale;

  return (
    <div
      className="min-h-screen flex flex-col max-w-[375px] mx-auto"
      style={{ backgroundColor: '#f8f9ff', color: '#121c28' }}
    >
      {/* 顶部：返回 + 进度环 */}
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={handleGoBack}
          disabled={cardIndex === 0 || showFragment}
          className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          style={{ backgroundColor: '#d9e3f4', color: '#4a4455' }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <ProgressRing current={cardIndex + 1} total={TOTAL_CARDS} />
      </div>

      {/* 跨阶段错误提示横幅 */}
      {error && (
        <div className="mx-6 mb-3 px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)' }}>
          <p className="text-sm" style={{ color: '#ba1a1a' }}>{error}</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {showFragment ? (
          <PersonaFragment
            key="fragment"
            text={fragmentText}
            onDismiss={handleFragmentDismiss}
          />
        ) : (
          <motion.div
            key={`card-${cardIndex}`}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="flex-1 flex flex-col px-6 pb-6"
          >
            {/* 插画区域 */}
            <div
              className="h-40 rounded-2xl overflow-hidden mb-4"
              style={{ backgroundColor: '#E8F4FF' }}
            >
              <img
                src={`/illustrations/${illustrationFiles[cardIndex]}`}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>

            {/* 场景文本 */}
            <p className="text-base leading-relaxed mb-4" style={{ color: '#121c28' }}>
              {card.scenarioText}
            </p>

            {/* 选项 / 纯文本 */}
            {isUnsentLetter ? (
              <div className="flex-1">
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  maxLength={card.freeTextMaxLength}
                  placeholder="写下你的想法……"
                  rows={4}
                  className="w-full rounded-lg px-4 py-3 text-sm resize-y focus:outline-none focus:border-[#2B8AEF] border-2 border-transparent transition-all"
                  style={{ backgroundColor: '#ffffff', color: '#121c28' }}
                />
                <p className="text-xs text-right mt-1" style={{ color: '#7b7487' }}>
                  {freeText.length}/{card.freeTextMaxLength}
                </p>
              </div>
            ) : (
              <div className="space-y-2 flex-1">
                {card.options.map((opt) => (
                  <motion.button
                    key={opt.optionId}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedOption(opt.optionId);
                      setFreeText('');
                    }}
                    className="w-full text-left p-3 rounded-xl border-2 text-sm transition-all"
                    style={
                      selectedOption === opt.optionId
                        ? { borderColor: '#2B8AEF', backgroundColor: 'rgba(43,138,239,0.08)', color: '#2B8AEF' }
                        : { borderColor: 'transparent', backgroundColor: '#ffffff', color: '#121c28' }
                    }
                  >
                    <span>
                      {opt.optionId}. {opt.text}
                    </span>
                  </motion.button>
                ))}

                {/* 自定义文本 */}
                {card.allowCustomText && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedOption('custom')}
                      className="w-full text-left p-3 rounded-xl border-2 text-sm transition-all"
                      style={
                        selectedOption === 'custom'
                          ? { borderColor: '#2B8AEF', backgroundColor: 'rgba(43,138,239,0.08)', color: '#2B8AEF' }
                          : { borderColor: 'transparent', backgroundColor: '#E8F4FF', color: '#7b7487' }
                      }
                    >
                      {COPY.btn.writeSelf}
                    </button>
                    {selectedOption === 'custom' && (
                      <div className="space-y-1">
                        <input
                          value={freeText}
                          onChange={(e) => setFreeText(e.target.value)}
                          maxLength={card.freeTextMaxLength}
                          placeholder="你的回答"
                          autoFocus
                          className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#2B8AEF] border-2 border-transparent transition-all"
                          style={{ backgroundColor: '#ffffff', color: '#121c28' }}
                        />
                        <p className="text-xs text-right" style={{ color: '#7b7487' }}>
                          {freeText.length}/{card.freeTextMaxLength}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* AI 灵感提示按钮 */}
            {hasFreeTextInput && (
              <div className="flex justify-end mt-3">
                <button
                  type="button"
                  onClick={handleGetHint}
                  disabled={hintLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: 'rgba(43,138,239,0.08)', border: '1px solid rgba(43,138,239,0.2)', color: '#2B8AEF' }}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  {hintLoading ? COPY.loading.hint : COPY.btn.needInspiration}
                </button>
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="button"
              onClick={handleSubmitCard}
              disabled={!canSubmit() || submitting}
              className="mt-6 py-4 px-8 rounded-full font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98]"
              style={{
                backgroundColor: '#2B8AEF',
                color: '#ffffff',
                boxShadow: '0 8px 16px -4px rgba(43, 138, 239, 0.3)',
              }}
            >
              {submitting ? COPY.submitting.phase1 : cardIndex === TOTAL_CARDS - 1 ? COPY.celebrate.phase1Done : COPY.btn.next}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
