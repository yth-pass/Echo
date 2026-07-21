/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 1.6 — 理想伴侣画像展示 + 用户微调反馈
 * 与 Phase 1.5 人格画像对称：LLM 合成 → 卡片展示 → 反馈调整
 */

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { DimensionBars } from './components/DimensionBars';
import {
  generateIdealPartnerSketch,
  adjustIdealPartnerSketch,
} from './onboarding-v2.api';
import { PHASE_LABELS } from './phase-labels';
import { COPY } from '../../../copy';
import { LottieLoader } from '../../../components/LottieLoader';
import type { ApiResult } from '../../../api/client';
import type { IdealPartnerSketchData, PhaseProps } from './onboarding-v2.types';

type ApiError = { ok: false; status: number; message: string };

function sketchErrorMsg(r: ApiResult<unknown>): string {
  if (r.ok) return '';
  const err = r as ApiError;
  if (err.status === 0) return COPY.error.network;
  if (err.status === -1) return COPY.error.notConfigured;
  if (err.status === 401) return COPY.error.loginExpired;
  if (err.status === 503) return COPY.error.aiUnavailable;
  return err.message || `生成失败 (${err.status})`;
}

export function Phase1_6IdealSketch({ onComplete, onGoBack }: PhaseProps) {
  const [sketch, setSketch] = useState<IdealPartnerSketchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSketch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await generateIdealPartnerSketch();
    setLoading(false);
    if (result.ok) {
      setSketch(result.data);
    } else {
      const msg = sketchErrorMsg(result);
      const errMsg = (result as ApiError).message;
      // 如果错误涉及 Phase 1 数据不完整，跳回 Phase 1
      if (errMsg?.includes('Phase 1')) {
        onGoBack?.('phase1', msg);
        return;
      }
      setError(msg);
    }
  }, [onGoBack]);

  useEffect(() => {
    fetchSketch();
  }, [fetchSketch]);

  /** 有反馈时：调用 adjust API 重新生成，留在当前页展示新结果 */
  const handleRegenerate = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await adjustIdealPartnerSketch(feedback.trim());
    setSubmitting(false);
    if (result.ok) {
      setSketch(result.data);
      setFeedback('');
    } else {
      setError(sketchErrorMsg(result));
    }
  };

  /** 确认满意：推进下一阶段 */
  const handleConfirm = () => {
    onComplete();
  };

  // 加载状态
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center max-w-[375px] mx-auto p-6 text-center" style={{ backgroundColor: '#f8f9ff' }}>
        <div className="flex justify-center mb-1">
          <LottieLoader size={480} />
        </div>
        <p className="text-base font-bold tracking-wide mt-1" style={{ color: '#7b7487' }}>正在描绘你的理想伴侣…</p>
        <p className="text-sm font-bold tracking-wide mt-1" style={{ color: '#7b7487' }}>{COPY.loading.sketchSub}</p>
      </div>
    );
  }

  // 错误状态
  if (error && !sketch) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center max-w-[375px] mx-auto p-6" style={{ backgroundColor: '#f8f9ff' }}>
        <p className="text-sm mb-4 text-center" style={{ color: '#ba1a1a' }}>{error}</p>
        <button
          type="button"
          onClick={fetchSketch}
          className="px-4 py-2 rounded-xl text-sm"
          style={{ backgroundColor: 'rgba(43,138,239,0.12)', color: '#2B8AEF' }}
        >
          {COPY.btn.tryAgain}
        </button>
      </div>
    );
  }

  if (!sketch) return null;

  return (
    <div className="min-h-screen flex flex-col max-w-[375px] mx-auto p-6 pb-28" style={{ backgroundColor: '#f8f9ff' }}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: '#121c28' }}>{PHASE_LABELS.phase1_6.full}</h2>
      </div>

      {/* Narrative Card */}
      <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: '#ffffff' }}>
        <div className="leading-relaxed whitespace-pre-line" style={{ color: '#121c28' }}>
          {sketch.narrative}
        </div>
      </div>

      {/* Dimension Bars */}
      <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: '#ffffff' }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: '#7b7487' }}>他们大概是什么样的人</h3>
        <DimensionBars dimensions={sketch.dimensions} />
      </div>

      {/* Feedback Section */}
      <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: '#ffffff' }}>
        <h3 className="text-sm font-medium mb-3" style={{ color: '#7b7487' }}>这个描述准确吗？</h3>
        <textarea
          className="w-full rounded-lg p-3 text-sm resize-none focus:outline-none border"
          style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4', color: '#121c28' }}
          placeholder="其实我需要的是一个更……的人"
          maxLength={100}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
        />
      </div>

      {/* 错误提示（有 sketch 但 adjust 失败时） */}
      {error && sketch && (
        <p className="text-sm mb-4 text-center" style={{ color: '#ba1a1a' }}>{error}</p>
      )}

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 px-6 py-4 max-w-[375px] mx-auto" style={{ backgroundColor: 'rgba(248,249,255,0.92)', backdropFilter: 'blur(6px)', borderTop: '1px solid #d9e3f4' }}>
        {feedback.trim() && (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={submitting}
            className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 mb-2 disabled:opacity-50"
            style={{ backgroundColor: '#ffffff', color: '#2B8AEF', border: '1px solid #2B8AEF' }}
          >
            {submitting ? COPY.loading.sketchRegen : '根据你的反馈重新生成'}
            {!submitting && <RefreshCw className="w-4 h-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ backgroundColor: '#2B8AEF', color: '#ffffff' }}
        >
          {submitting ? COPY.loading.sketchRegen : '看起来没问题'}
          {!submitting && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
