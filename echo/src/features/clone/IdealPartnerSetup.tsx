/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 理想型补做流程页（已 finalize 用户）
 *
 * 两种入口模式（由路由 state.skipCards 决定）：
 *  - skipCards=false（3 道探测卡未答）：答题 3 张 → 提交 cards → generate → 展示
 *  - skipCards=true（3 道探测卡已答，仅缺 sketch）：跳过答题，直接 generate → 展示
 *
 * 绕开 OnboardingSession.completed=false 限制，直接调 /clones/me/ideal-partner/* 端点。
 * 完成后 navigate('/clone')，CloneView 重新 mount 触发 fetchClone 显示新理想型。
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { SCENARIO_CARDS } from '../onboarding/v2/scenario-cards.data';
import {
  generateIdealPartnerClone,
  submitIdealPartnerCards,
  type IdealPartnerCardInput,
} from '../../api/clone';
import type { ApiResult } from '../../api/client';
import { COPY } from '../../copy';
import { LottieLoader } from '../../components/LottieLoader';

const IDEAL_CARD_IDS = ['unexpected_breakfast', 'silent_night', 'song_choice'];

/** 3 道理想卡对应的插画文件名（与 Phase1Cards 一致） */
const IDEAL_ILLUSTRATIONS = ['Q16_breakfast.png', 'Q17_silent.png', 'Q18_song.png'];

type Step = 'cards' | 'generating' | 'done' | 'error';

type ApiError = { ok: false; status: number; message: string };

/** 统一提取 ApiResult 失败分支的错误文案 */
function errMsg(r: ApiResult<unknown>): string {
  const err = r as ApiError;
  if (err.status === 0) return COPY.error.network;
  if (err.status === 401) return COPY.error.loginExpired;
  if (err.status === 503) return COPY.error.aiUnavailable;
  return err.message || `操作失败 (${err.status})`;
}

export function IdealPartnerSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const skipCards =
    (location.state as { skipCards?: boolean } | null)?.skipCards === true;

  const cards = SCENARIO_CARDS.filter((c) => IDEAL_CARD_IDS.includes(c.cardId));

  const [step, setStep] = useState<Step>(skipCards ? 'generating' : 'cards');
  const [cardIndex, setCardIndex] = useState(0);
  const [responses, setResponses] = useState<IdealPartnerCardInput[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);

  const doGenerate = useCallback(async () => {
    setStep('generating');
    setError(null);
    const result = await generateIdealPartnerClone();
    if (result.ok) {
      setNarrative(result.data.idealPartnerNarrative);
      setStep('done');
    } else {
      setError(errMsg(result));
      setStep('error');
    }
  }, []);

  // skipCards 模式：mount 即生成
  useEffect(() => {
    if (skipCards) void doGenerate();
  }, [skipCards, doGenerate]);

  const submitAndGenerate = useCallback(async (cardsInput: IdealPartnerCardInput[]) => {
    setStep('generating');
    setError(null);
    const submitResult = await submitIdealPartnerCards(cardsInput);
    if (!submitResult.ok) {
      setError(errMsg(submitResult));
      setStep('error');
      return;
    }
    const genResult = await generateIdealPartnerClone();
    if (genResult.ok) {
      setNarrative(genResult.data.idealPartnerNarrative);
      setStep('done');
    } else {
      setError(errMsg(genResult));
      setStep('error');
    }
  }, []);

  const card = cards[cardIndex];

  const canSubmit = (): boolean => {
    if (selectedOption === 'custom') return freeText.trim().length > 0;
    return selectedOption != null;
  };

  const handleSubmitCard = async () => {
    if (!canSubmit() || !card) return;
    const resp: IdealPartnerCardInput = {
      cardId: card.cardId,
      choice: selectedOption === 'custom' ? 'custom' : selectedOption!,
      freeText: freeText.trim() || undefined,
    };
    const newResponses = [...responses, resp];
    setResponses(newResponses);
    setSelectedOption(null);
    setFreeText('');

    if (cardIndex < cards.length - 1) {
      setCardIndex(cardIndex + 1);
    } else {
      await submitAndGenerate(newResponses);
    }
  };

  const handleBack = () => {
    if (cardIndex > 0) {
      const prevIndex = cardIndex - 1;
      const prev = responses[prevIndex];
      if (prev) {
        setSelectedOption(prev.choice === 'custom' ? 'custom' : prev.choice);
        setFreeText(prev.freeText ?? '');
        setResponses(responses.slice(0, prevIndex));
      } else {
        setSelectedOption(null);
        setFreeText('');
      }
      setCardIndex(prevIndex);
    } else {
      navigate(-1);
    }
  };

  const handleRetry = () => {
    setError(null);
    if (skipCards || responses.length === 0) {
      void doGenerate();
    } else {
      void submitAndGenerate(responses);
    }
  };

  // 生成中
  if (step === 'generating') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center max-w-[375px] mx-auto p-6 text-center"
        style={{ backgroundColor: '#f8f9ff' }}
      >
        <div className="flex justify-center mb-1">
          <LottieLoader size={480} />
        </div>
        <p className="text-base font-bold tracking-wide mt-2" style={{ color: '#7b7487' }}>
          正在描绘你的理想伴侣…
        </p>
        <p className="text-sm mt-1" style={{ color: '#7b7487' }}>
          根据你的 3 个选择合成画像
        </p>
      </div>
    );
  }

  // 完成
  if (step === 'done' && narrative) {
    return (
      <div
        className="min-h-screen flex flex-col max-w-[375px] mx-auto p-6 pb-28"
        style={{ backgroundColor: '#f8f9ff' }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: '#121c28' }}>
          你需要什么样的人？
        </h2>
        <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: '#ffffff' }}>
          <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#121c28' }}>
            {narrative}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/clone')}
          className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
          style={{ backgroundColor: '#2B8AEF', color: '#ffffff' }}
        >
          完成，返回分身
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // 错误
  if (step === 'error') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center max-w-[375px] mx-auto p-6 text-center"
        style={{ backgroundColor: '#f8f9ff' }}
      >
        <p className="text-sm mb-4" style={{ color: '#ba1a1a' }}>{error}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-3 rounded-2xl text-sm font-medium border-2"
            style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4', color: '#4a4455' }}
          >
            返回
          </button>
          <button
            type="button"
            onClick={handleRetry}
            className="px-6 py-3 rounded-2xl text-sm font-medium"
            style={{ backgroundColor: 'rgba(43,138,239,0.12)', color: '#2B8AEF' }}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // 答题阶段
  if (!card) return null;
  return (
    <div
      className="min-h-screen flex flex-col max-w-[375px] mx-auto"
      style={{ backgroundColor: '#f8f9ff', color: '#121c28' }}
    >
      {/* 顶部：返回 + 进度 */}
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={handleBack}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: '#d9e3f4', color: '#4a4455' }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium" style={{ color: '#7b7487' }}>
          {cardIndex + 1} / {cards.length}
        </span>
      </div>

      {error && (
        <div
          className="mx-6 mb-3 px-4 py-3 rounded-xl"
          style={{ backgroundColor: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)' }}
        >
          <p className="text-sm" style={{ color: '#ba1a1a' }}>{error}</p>
        </div>
      )}

      <div className="flex-1 flex flex-col px-6 pb-6">
        {/* 插画 */}
        <div
          className="h-40 rounded-2xl overflow-hidden mb-4"
          style={{ backgroundColor: '#E8F4FF' }}
        >
          <img
            src={`/illustrations/${IDEAL_ILLUSTRATIONS[cardIndex] ?? ''}`}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>

        {/* 场景文本 */}
        <p className="text-base leading-relaxed mb-4" style={{ color: '#121c28' }}>
          {card.scenarioText}
        </p>

        {/* 选项 */}
        <div className="space-y-2 flex-1">
          {card.options.map((opt) => (
            <button
              key={opt.optionId}
              type="button"
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
              {opt.optionId}. {opt.text}
            </button>
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
                <input
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  maxLength={card.freeTextMaxLength}
                  placeholder="你的回答"
                  autoFocus
                  className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none border-2 border-transparent transition-all"
                  style={{ backgroundColor: '#ffffff', color: '#121c28' }}
                />
              )}
            </>
          )}
        </div>

        {/* 提交按钮 */}
        <button
          type="button"
          onClick={() => void handleSubmitCard()}
          disabled={!canSubmit()}
          className="mt-6 py-4 px-8 rounded-full font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98]"
          style={{ backgroundColor: '#2B8AEF', color: '#ffffff', boxShadow: '0 8px 16px -4px rgba(43, 138, 239, 0.3)' }}
        >
          {cardIndex === cards.length - 1 ? '生成理想型' : COPY.btn.next}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
