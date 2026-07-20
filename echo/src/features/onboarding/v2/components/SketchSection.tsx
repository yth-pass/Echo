/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 1.5 人格画像节卡片 — 句子级精准编辑
 * 点击任意句子 → 内联修改 → 所有修改统一提交
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pencil, Check, X } from 'lucide-react';
import type { SectionKey } from '../onboarding-v2.types';
import { SECTION_META } from '../onboarding-v2.types';

/** 按中英文标点拆分句子 */
function splitSentences(text: string): string[] {
  // 按 。！？!?\n 拆分，保留分隔符
  const parts = text.split(/(?<=[。！？!?])\s*|\n+/);
  return parts.map((s) => s.trim()).filter(Boolean);
}

export interface SentenceEdit {
  sectionKey: SectionKey;
  originalSentence: string;
  correctedSentence: string;
}

/** 打字机效果：逐字渐显 */
function TypewriterText({
  text,
  baseDelay = 0,
  charInterval = 0.018,
}: {
  text: string;
  baseDelay?: number;
  charInterval?: number;
}) {
  const chars = Array.from(text);
  return (
    <>
      {chars.map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: baseDelay + i * charInterval,
            duration: 0.12,
          }}
        >
          {char}
        </motion.span>
      ))}
    </>
  );
}

export function SketchSection({
  sectionKey,
  narrative,
  edits,
  onEditSentence,
  onRemoveEdit,
  typewriterDelay = 0,
}: {
  sectionKey: SectionKey;
  narrative: string;
  /** 该 section 已有的句子级编辑 */
  edits: SentenceEdit[];
  /** 用户点击某个句子并提交了修改 */
  onEditSentence: (edit: SentenceEdit) => void;
  /** 用户撤销某个句子修改 */
  onRemoveEdit: (originalSentence: string) => void;
  /** 打字机动效的基础延迟（秒），由父组件按 section 序号传入 */
  typewriterDelay?: number;
}) {
  const meta = SECTION_META[sectionKey];
  const sentences = splitSentences(narrative);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');

  const isEdited = (sentence: string) =>
    edits.some((e) => e.originalSentence === sentence);

  const getEditFor = (sentence: string) =>
    edits.find((e) => e.originalSentence === sentence);

  const handleSubmit = (sentence: string) => {
    if (!feedback.trim()) return;
    onEditSentence({
      sectionKey,
      originalSentence: sentence,
      correctedSentence: feedback.trim(),
    });
    setEditingIdx(null);
    setFeedback('');
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    const sentence = sentences[idx];
    const existing = getEditFor(sentence);
    setFeedback(existing?.correctedSentence ?? sentence);
  };

  return (
    <div className="p-4 rounded-2xl border" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{meta.icon}</span>
        <span className="text-sm font-medium" style={{ color: '#121c28' }}>{meta.title}</span>
      </div>

      <div className="text-sm leading-relaxed space-y-1 text-left" style={{ color: '#121c28' }}>
        {sentences.map((sentence, idx) => {
          const edited = isEdited(sentence);
          const editData = getEditFor(sentence);
          const isEditing = editingIdx === idx;
          const sentenceDelay = typewriterDelay + idx * 0.15;

          return (
            <div key={idx}>
              {isEditing ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2 py-1"
                >
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    maxLength={100}
                    rows={2}
                    autoFocus
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4', color: '#121c28' }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setEditingIdx(null); setFeedback(''); }}
                      className="px-2 py-1 rounded-lg text-[11px]"
                      style={{ color: '#7b7487' }}
                    >
                      <X className="w-3 h-3 inline mr-0.5" />
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmit(sentence)}
                      disabled={!feedback.trim()}
                      className="px-2 py-1 rounded-lg text-[11px] flex items-center gap-1 disabled:opacity-40"
                      style={{ backgroundColor: 'rgba(43,138,239,0.12)', color: '#2B8AEF' }}
                    >
                      <Check className="w-3 h-3" />
                      确认修改
                    </button>
                  </div>
                </motion.div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(idx)}
                  className={`block w-full text-left cursor-pointer transition-colors rounded px-0.5 ${
                    edited
                      ? 'border-b border-dashed'
                      : 'hover:text-black'
                  }`}
                  style={edited ? {
                    backgroundColor: 'rgba(43,138,239,0.08)',
                    color: '#2B8AEF',
                    borderColor: 'rgba(43,138,239,0.3)',
                  } : {}}
                  title={edited ? '点击再次修改' : '点击修改这句'}
                >
                  {edited ? (
                    editData!.correctedSentence
                  ) : (
                    <TypewriterText text={sentence} baseDelay={sentenceDelay} />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部提示 */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px]" style={{ color: '#7b7487' }}>
          点击任意句子可修改
        </p>
        {edits.length > 0 && (
          <span className="text-[10px]" style={{ color: '#2B8AEF' }}>
            已修改 {edits.length} 处
          </span>
        )}
      </div>
    </div>
  );
}
