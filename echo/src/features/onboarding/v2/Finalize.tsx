/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Finalize — v2.2 入驻最终化
 * 薄包装：调 API + 显示状态 + 完成后回调
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { finalizeOnboarding } from './onboarding-v2.api';
import { COPY } from '../../../copy';
import { LottieLoader } from '../../../components/LottieLoader';
import type { PhaseProps, OnboardingPhase } from './onboarding-v2.types';

/** 根据后端错误信息推断应返回的阶段 */
function inferTargetPhase(errMsg: string): OnboardingPhase {
  if (errMsg.includes('Phase 0') || errMsg.includes('身份信息')) return 'phase0';
  if (errMsg.includes('Phase 1') || errMsg.includes('情境卡片')) return 'phase1';
  if (errMsg.includes('Phase 1.5') || errMsg.includes('人格画像')) return 'phase1_5';
  if (errMsg.includes('Phase 2') || errMsg.includes('角色扮演') || errMsg.includes('对话')) return 'phase2';
  return 'phase2';
}

export function Finalize({ onComplete, onGoBack }: PhaseProps) {
  const [phase, setPhase] = useState<'pending' | 'running' | 'done' | 'error'>('pending');
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = COPY.loading.finalizeSteps;

  // 每 8 秒切换下一步文案，最后一条常驻直到完成
  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => {
      setStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 8_000);
    return () => clearInterval(id);
  }, [phase, steps.length]);

  const run = useCallback(async () => {
    setPhase('running');
    setError(null);
    const result = await finalizeOnboarding();
    if (result.ok) {
      if (result.data?.onboardingComplete) {
        setPhase('done');
      } else {
        setPhase('error');
        setError(COPY.error.onboardingIncomplete);
      }
    } else {
      setPhase('error');
      const { status, message } = result as { status: number; message: string };
      if (status === 0) {
        setError(COPY.error.network);
      } else if (status === 401) {
        setError(COPY.error.loginExpired);
      } else {
        setError(message || COPY.error.onboardingIncomplete);
      }
    }
  }, []);

  // mount 自动触发
  useEffect(() => {
    run();
  }, [run]);

  const handleGoBack = () => {
    const targetPhase = error ? inferTargetPhase(error) : 'phase2';
    onGoBack?.(targetPhase, error ?? undefined);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center max-w-[375px] mx-auto p-6 text-center"
      style={{ backgroundColor: '#f8f9ff' }}
    >
      <div className="flex justify-center mb-1">
        {phase === 'error' ? (
          <AlertCircle className="w-12 h-12" style={{ color: '#ba1a1a' }} />
        ) : (
          <LottieLoader size={480} />
        )}
      </div>

      <h2 className="text-xl font-bold" style={{ color: '#121c28' }}>
        {phase === 'done' ? COPY.celebrate.finalizeDone : phase === 'error' ? '出错了' : '分身正在生成'}
      </h2>
      <p className="text-base font-bold tracking-wide mt-1" style={{ color: '#7b7487' }}>
        {phase === 'done'
          ? COPY.celebrate.finalizeSub
          : phase === 'error'
            ? ''
            : COPY.loading.finalize}
      </p>

      {phase === 'running' && (
        <p
          key={stepIndex}
          className="text-sm mt-3 animate-[fadeIn_0.6s_ease-in]"
          style={{ color: '#7b7487' }}
        >
          {steps[stepIndex]}
        </p>
      )}

      {error && (
        <p className="text-sm mt-3 leading-relaxed" style={{ color: '#ba1a1a' }}>
          {error}
        </p>
      )}

      {phase === 'error' && (
        <div className="flex gap-3 mt-6">
          {onGoBack && (
            <button
              type="button"
              onClick={handleGoBack}
              className="px-5 py-3 rounded-2xl text-sm font-medium flex items-center gap-1.5 border-2"
              style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4', color: '#4a4455' }}
            >
              <ArrowLeft className="w-4 h-4" />
              返回检查
            </button>
          )}
          <button
            type="button"
            onClick={run}
            className="px-6 py-3 rounded-2xl text-sm font-medium"
            style={{ backgroundColor: 'rgba(43,138,239,0.12)', color: '#2B8AEF' }}
          >
            {COPY.btn.tryAgain}
          </button>
        </div>
      )}

      {phase === 'done' && (
        <button
          type="button"
          onClick={onComplete}
          className="mt-6 px-6 py-3 rounded-2xl text-sm font-bold"
          style={{ backgroundColor: '#2B8AEF', color: '#ffffff' }}
        >
          {COPY.celebrate.finalizeCta}
        </button>
      )}
    </div>
  );
}
