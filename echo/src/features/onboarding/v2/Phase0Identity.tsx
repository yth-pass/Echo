/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 0 — 渐进式名片 UI
 * 12 个字段单步渐进采集，名片翻转动画
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, SkipForward, X } from 'lucide-react';
import { PHASE0_FIELDS } from './phase0-fields.data';
import { FieldCard } from './components/FieldCard';
import { submitPhase0 } from './onboarding-v2.api';
import { COPY } from '../../../copy';
import type { ApiResult } from '../../../api/client';
import type { PhaseProps, Phase0Payload, GenderOption, AgeBand, EducationLevel, FamilyMember, MatchPreference } from './onboarding-v2.types';

const TOTAL_FIELDS = PHASE0_FIELDS.length;

/** D2 修复：Phase 0 localStorage checkpoint key（按 userId 隔离） */
function phase0StorageKey(userId: string): string {
  return `onboarding_phase0_formdata_${userId}`;
}

type ApiError = { ok: false; status: number; message: string };

/** 从 formData 中提取匹配偏好 */
function buildMatchPreference(data: Partial<Phase0Payload>): MatchPreference | undefined {
  const g = (data as Record<string, unknown>).matchPreferredGender as string | undefined;
  const a = (data as Record<string, unknown>).matchPreferredAgeBand as string | undefined;
  const c = (data as Record<string, unknown>).matchPreferredCity as string | undefined;
  const o = (data as Record<string, unknown>).matchPreferredOccupation as string | undefined;
  if (!g && !a && !c && !o) return undefined;
  return {
    preferredGender: (g as MatchPreference['preferredGender']) ?? undefined,
    preferredAgeBand: a ? [a] : undefined,
    preferredCity: c ?? undefined,
    preferredOccupation: o ? [o] : undefined,
  };
}

function resultErrorMessage(r: ApiResult<unknown>): string {
  if (r.ok) return '';
  const err = r as ApiError;
  if (err.status === 0) return COPY.error.network;
  if (err.status === -1) return COPY.error.notConfigured;
  if (err.status === 401) return COPY.error.loginExpired;
  return err.message || `提交失败 (${err.status})`;
}

function getFieldValue(data: Partial<Phase0Payload>, key: string): unknown {
  return (data as Record<string, unknown>)[key];
}

function setFieldValue(
  data: Partial<Phase0Payload>,
  key: string,
  value: unknown,
): Partial<Phase0Payload> {
  return { ...data, [key]: value };
}

export function Phase0Identity({ userId, onComplete, onClose }: PhaseProps & { userId: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  // D2 修复：mount 时从 localStorage 恢复 formData（支持同设备中途退出恢复 + 跨设备恢复）
  // OnboardingShell 在 D1 中会把后端 phase0Data 写入同一个 key
  const [formData, setFormData] = useState<Partial<Phase0Payload>>(() => {
    try {
      const saved = localStorage.getItem(phase0StorageKey(userId));
      return saved ? JSON.parse(saved) as Partial<Phase0Payload> : {};
    } catch {
      return {};
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  // D2 修复：formData 变化时保存到 localStorage（checkpoint）
  useEffect(() => {
    try {
      localStorage.setItem(phase0StorageKey(userId), JSON.stringify(formData));
    } catch { /* silent */ }
  }, [formData, userId]);

  /** 判断某个字段是否应该显示（showWhen 条件） */
  const shouldShowField = useCallback(
    (fieldKey: string, showWhen?: { field: string; value: string }): boolean => {
      if (!showWhen) return true;
      const currentVal = getFieldValue(formData, showWhen.field);
      return currentVal === showWhen.value;
    },
    [formData],
  );

  /** 获取下一个可见字段的索引 */
  const getNextVisibleIdx = useCallback(
    (fromIdx: number): number => {
      for (let i = fromIdx + 1; i < TOTAL_FIELDS; i++) {
        const f = PHASE0_FIELDS[i];
        if (shouldShowField(f.key, f.showWhen)) return i;
      }
      return TOTAL_FIELDS; // 没有更多字段
    },
    [shouldShowField],
  );

  /** 获取上一个可见字段的索引 */
  const getPrevVisibleIdx = useCallback(
    (fromIdx: number): number => {
      for (let i = fromIdx - 1; i >= 0; i--) {
        const f = PHASE0_FIELDS[i];
        if (shouldShowField(f.key, f.showWhen)) return i;
      }
      return -1;
    },
    [shouldShowField],
  );

  const field = PHASE0_FIELDS[activeIdx];
  const currentValue = getFieldValue(formData, field.key);

  const isValid = useCallback((): boolean => {
    if (!field.required) return true;
    if (field.inputType === 'tag-input') {
      const arr = (currentValue as string[]) ?? [];
      return arr.length >= (field.minItems ?? 1);
    }
    if (typeof currentValue === 'string') return currentValue.trim().length > 0;
    return currentValue != null && currentValue !== '';
  }, [field, currentValue]);

  const handleChange = (val: unknown) => {
    setFormData((prev) => setFieldValue(prev, field.key, val));
  };

  const handleNextIfValid = () => {
    if (isValid()) handleNext();
  };

  const handleNext = async () => {
    const nextIdx = getNextVisibleIdx(activeIdx);
    if (nextIdx < TOTAL_FIELDS) {
      setActiveIdx(nextIdx);
    } else {
      // 最后一个字段 → 提交
      setSubmitting(true);
      setError(null);

      // 构建 payload
      const payload: Phase0Payload = {
        displayName: (formData.displayName as string) ?? '',
        preferredAddress: (formData.displayName as string) ?? '',
        genderIdentity: (formData.genderIdentity as GenderOption) ?? 'unspecified',
        ageBand: (formData.ageBand as AgeBand) ?? '23-27',
        hometownCity: (formData.hometownCity as string) ?? '',
        currentCity: (formData.currentCity as string) ?? '',
        education: (formData.education as EducationLevel) ?? 'bachelor',
        occupation: (formData.occupation as string) ?? '',
        industry: (formData.industry as string) ?? '',
        entrepreneurshipField: (formData.entrepreneurshipField as string) ?? undefined,
        workDescription: (formData.workDescription as string) ?? '',
        keyLifeExperiences: (formData.keyLifeExperiences as string[]) ?? [],
        selfIntroOneLiner: (formData.selfIntroOneLiner as string) ?? '',
        goalOnEcho: (formData.goalOnEcho as string) ?? undefined,
        familyMembers: (formData.familyMembers as FamilyMember[]) ?? undefined,
        matchPreference: buildMatchPreference(formData),
      };

      const result = await submitPhase0(payload);
      setSubmitting(false);
      if (result.ok) {
        // D2 修复：提交成功后清理 localStorage checkpoint（避免下次进入时恢复旧数据）
        try { localStorage.removeItem(phase0StorageKey(userId)); } catch { /* silent */ }
        // 暂存性别，供 Phase 1 选择插图集
        try { localStorage.setItem('echo_onboarding_gender', payload.genderIdentity); } catch { /* silent */ }
        setFlipped(true);
        setTimeout(() => onComplete(), 1500);
      } else {
        setError(resultErrorMessage(result));
      }
    }
  };

  const handleSkip = () => {
    const nextIdx = getNextVisibleIdx(activeIdx);
    if (nextIdx < TOTAL_FIELDS) {
      setActiveIdx(nextIdx);
    }
  };

  const handleBack = () => {
    const prevIdx = getPrevVisibleIdx(activeIdx);
    if (prevIdx >= 0) setActiveIdx(prevIdx);
  };

  return (
    <div
      className="min-h-screen flex flex-col max-w-[375px] mx-auto relative overflow-hidden"
      style={{ backgroundColor: '#f8f9ff', color: '#121c28' }}
    >
      {/* Header: × 按钮 + 进度条 + 计数器同行 */}
      <header className="w-full px-6 pt-6 pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors"
          style={{ backgroundColor: '#d9e3f4', color: '#4a4455' }}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#d9e3f4' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: '#2B8AEF' }}
            animate={{ width: `${((activeIdx + 1) / TOTAL_FIELDS) * 100}%` }}
            transition={{ type: 'spring', stiffness: 100 }}
          />
        </div>

        <span className="text-xs shrink-0" style={{ color: '#7b7487' }}>
          {activeIdx + 1}/{TOTAL_FIELDS}
        </span>
      </header>

      <AnimatePresence mode="wait">
        {!flipped ? (
          <motion.div
            key={`field-${activeIdx}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col px-6 pb-28"
          >
            {/* 两个人物趴在标题卡片上方 — 跨设备鲁棒定位（flex 子元素，不依赖视口坐标） */}
            <div className="w-full flex justify-center mb-2 mt-2 pointer-events-none relative z-0">
              <img
                src="/illustrations/phase0-background.png"
                alt=""
                className="w-[280px] h-[120px] object-contain"
              />
            </div>

            {/* 字段标题 — relative z-20 确保盖在人物上方 */}
            <div className="mb-6 flex flex-col gap-1 relative z-20">
              <h2
                className="text-3xl font-extrabold tracking-tight relative inline-block"
                style={{ color: '#2B8AEF' }}
              >
                {field.label}
                {field.required && (
                  <span
                    className="absolute -top-1 -right-3 w-2 h-2 rounded-full"
                    style={{ backgroundColor: '#a43073' }}
                  />
                )}
              </h2>
              {field.subtitle && (
                <p className="text-lg" style={{ color: '#4a4455' }}>
                  {field.subtitle}
                </p>
              )}
            </div>

            {/* 字段输入 */}
            <div className="flex-1">
              <FieldCard field={field} value={currentValue} onChange={handleChange} onNext={handleNextIfValid} />
            </div>

            {/* 回声小字 — 填空区，每字段一条定制文案 */}
            {field.echoHint && (
              <p
                className="text-sm leading-relaxed mt-6 text-center"
                style={{ color: '#9b95a8' }}
              >
                {field.echoHint}
              </p>
            )}

            {error && (
              <p className="text-xs mt-2" style={{ color: '#ba1a1a' }}>
                {error}
              </p>
            )}
          </motion.div>
        ) : (
          /* 名片翻转完成 */
          <motion.div
            key="flip-done"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center px-6"
          >
            <motion.div
              initial={{ rotateY: 0 }}
              animate={{ rotateY: 360 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              className="w-24 h-32 rounded-2xl border mb-4 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(43,138,239,0.15), rgba(43,138,239,0.08))',
                borderColor: '#d9e3f4',
              }}
            >
              <span className="text-3xl">🪪</span>
            </motion.div>
            <p className="text-sm" style={{ color: '#4a4455' }}>
              {COPY.celebrate.phase0Done}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部导航（固定定位） */}
      {!flipped && (
        <footer
          className="fixed bottom-0 left-0 right-0 z-20 max-w-[375px] mx-auto p-6"
          style={{ background: 'linear-gradient(to top, #f8f9ff 80%, transparent)' }}
        >
          <div className="flex justify-between items-center w-full">
            {activeIdx > 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: '#d9e3f4', color: '#4a4455' }}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-20" />
            )}

            {!field.required && !isValid() ? (
              <button
                type="button"
                onClick={handleSkip}
                className="px-6 py-3 rounded-full text-sm flex items-center gap-1 transition-colors"
                style={{ color: '#7b7487' }}
              >
                <SkipForward className="w-4 h-4" />
                {field.skipLabel ?? COPY.btn.skip}
              </button>
            ) : (
              <div className="flex-1" />
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={!isValid() || submitting}
              className="py-4 px-8 rounded-full font-semibold text-sm flex items-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98]"
              style={{
                backgroundColor: '#2B8AEF',
                color: '#ffffff',
                boxShadow: '0 8px 16px -4px rgba(43, 138, 239, 0.3)',
              }}
            >
              {submitting
                ? COPY.submitting.phase0
                : activeIdx === TOTAL_FIELDS - 1
                  ? COPY.btn.done
                  : COPY.btn.continue}
              {!submitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
