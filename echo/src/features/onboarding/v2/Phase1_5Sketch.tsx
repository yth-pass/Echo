/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 1.5 — 人格画像展示 + 句子级精准编辑
 * 8 节叙事文本 → 点击任意句子修改 → 批量提交所有修正
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, X, Info } from 'lucide-react';
import { SketchSection, type SentenceEdit } from './components/SketchSection';
import {
  generatePersonaSketch,
  batchAdjustPersonaSketch,
  type PersonaSketchData,
} from './onboarding-v2.api';
import { COPY } from '../../../copy';
import { LottieLoader } from '../../../components/LottieLoader';
import type { ApiResult } from '../../../api/client';
import type { PersonaSketchSection, PhaseProps, SectionKey } from './onboarding-v2.types';
import { SECTION_META } from './onboarding-v2.types';

const SECTION_KEYS: SectionKey[] = [
  'identityNarrative',
  'personalityTexture',
  'coreBeliefs',
  'valuesInAction',
  'caringStyle',
  'socialBoundaries',
  'contradictions',
  'voiceAnchors',
];

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

function parseSections(sketch: PersonaSketchData): PersonaSketchSection[] {
  return SECTION_KEYS.map((key) => {
    const raw = sketch.sections[key];
    const narrative = Array.isArray(raw) ? raw.join('\n') : (raw ?? '');
    return { key, narrative };
  });
}

export function Phase1_5Sketch({ onComplete, onGoBack }: PhaseProps) {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<PersonaSketchSection[]>([]);
  const [allEdits, setAllEdits] = useState<Map<SectionKey, SentenceEdit[]>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHintPopup, setShowHintPopup] = useState(true);

  const fetchSketch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAllEdits(new Map());
    const result = await generatePersonaSketch();
    setLoading(false);
    if (result.ok) {
      setSections(parseSections(result.data));
    } else {
      const msg = sketchErrorMsg(result);
      const errMsg = (result as ApiError).message;
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

  const totalEdits = Array.from(allEdits.values()).reduce((sum, arr) => sum + arr.length, 0);

  /** 添加/更新某个句子的编辑 */
  const handleEditSentence = useCallback(
    (edit: SentenceEdit) => {
      setAllEdits((prev) => {
        const next = new Map(prev);
        const existing = next.get(edit.sectionKey) ?? [];
        // 替换或追加
        const idx = existing.findIndex(
          (e) => e.originalSentence === edit.originalSentence,
        );
        if (idx >= 0) {
          existing[idx] = edit;
        } else {
          existing.push(edit);
        }
        next.set(edit.sectionKey, [...existing]);
        return next;
      });
    },
    [],
  );

  /** 撤销某个句子编辑 */
  const handleRemoveEdit = useCallback(
    (sectionKey: SectionKey, originalSentence: string) => {
      setAllEdits((prev) => {
        const next = new Map(prev);
        const existing = next.get(sectionKey) ?? [];
        next.set(
          sectionKey,
          existing.filter((e) => e.originalSentence !== originalSentence),
        );
        return next;
      });
    },
    [],
  );

  /** 提交所有修改 */
  const handleSubmitAll = async () => {
    if (totalEdits === 0) {
      onComplete();
      return;
    }
    setSubmitting(true);
    setError(null);
    const corrections = Array.from(allEdits.values()).flat().map((e) => ({
      sectionKey: e.sectionKey,
      originalSentence: e.originalSentence,
      correctedSentence: e.correctedSentence,
    }));
    const result = await batchAdjustPersonaSketch(corrections);
    setSubmitting(false);
    if (result.ok) {
      setSections(parseSections(result.data));
      setAllEdits(new Map());
      // 重新生成后让用户再看看，不自动跳走
    } else {
      setError(sketchErrorMsg(result));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center max-w-[375px] mx-auto p-6 text-center" style={{ backgroundColor: '#f8f9ff' }}>
        <div className="flex justify-center mb-1">
          <LottieLoader size={480} />
        </div>
        <p className="text-base font-bold tracking-wide mt-1" style={{ color: '#7b7487' }}>{COPY.loading.sketch}</p>
        <p className="text-sm font-bold tracking-wide mt-1" style={{ color: '#7b7487' }}>{COPY.loading.sketchSub}</p>
      </div>
    );
  }

  if (error) {
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

  return (
    <div className="min-h-screen flex flex-col max-w-[375px] mx-auto p-6 pb-28" style={{ backgroundColor: '#f8f9ff' }}>
      <div className="mb-6 relative">
        <h2 className="text-xl font-bold" style={{ color: '#121c28' }}>你的人格画像</h2>

        {/* 可关闭的操作提示弹窗 */}
        <AnimatePresence>
          {showHintPopup && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="mt-3 p-3 pr-8 rounded-xl border shadow-sm"
              style={{ backgroundColor: '#E8F4FF', borderColor: '#d9e3f4' }}
            >
              <button
                type="button"
                onClick={() => setShowHintPopup(false)}
                className="absolute top-2 right-2 p-1 rounded-full transition-colors"
                style={{ color: '#7b7487' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#2B8AEF' }} />
                <p className="text-xs leading-relaxed" style={{ color: '#7b7487' }}>
                  点击任意句子可以修改，修改完后统一提交重新生成
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-3 flex-1">
        <AnimatePresence>
          {sections.map((s, i) => (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <SketchSection
                sectionKey={s.key}
                narrative={s.narrative}
                edits={allEdits.get(s.key) ?? []}
                onEditSentence={(edit) => handleEditSentence(edit)}
                onRemoveEdit={(sentence) => handleRemoveEdit(s.key, sentence)}
                typewriterDelay={0.3 + i * 0.08}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 底部固定按钮 */}
      <div className="fixed bottom-0 left-0 right-0 px-6 py-4 max-w-[375px] mx-auto" style={{ backgroundColor: 'rgba(248,249,255,0.92)', backdropFilter: 'blur(6px)', borderTop: '1px solid #d9e3f4' }}>
        {totalEdits > 0 && (
          <p className="text-[11px] mb-2 text-center" style={{ color: '#2B8AEF' }}>
            共 {totalEdits} 处修改，提交后将重新生成画像
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmitAll}
          disabled={submitting}
          className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ backgroundColor: '#2B8AEF', color: '#ffffff' }}
        >
          {submitting
            ? COPY.loading.sketchRegen
            : totalEdits > 0
              ? `提交修改并重新生成`
              : COPY.btn.confirmSketch}
          {!submitting && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
