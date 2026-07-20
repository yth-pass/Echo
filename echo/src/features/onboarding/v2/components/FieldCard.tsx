/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 单字段渲染器 — 根据 Phase0FieldDef.inputType 分发
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { ChoiceCard } from './ChoiceCard';
import type { Phase0FieldDef, FamilyMember } from '../onboarding-v2.types';

export function FieldCard({
  field,
  value,
  onChange,
  onNext,
}: {
  field: Phase0FieldDef;
  value: unknown;
  onChange: (val: unknown) => void;
  onNext?: () => void;
}) {
  const inputCls =
    'w-full bg-white border-2 border-transparent rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#2B8AEF] transition-all placeholder:text-[#ccc3d8]';

  if (field.inputType === 'text') {
    const strVal = (value as string) ?? '';
    return (
      <div className="space-y-2">
        <div className="relative">
          <input
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onNext) onNext();
            }}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            className={inputCls}
            style={{ color: '#121c28', boxShadow: '0 16px 32px -4px rgba(43, 138, 239, 0.08)' }}
          />
          {field.maxLength != null && (
            <div className="absolute bottom-3 right-4 pointer-events-none">
              <span
                className="text-xs font-bold"
                style={{ color: strVal.length > 0 ? '#2B8AEF' : '#ccc3d8' }}
              >
                {strVal.length}/{field.maxLength}
              </span>
            </div>
          )}
        </div>
        {field.recommendedMin != null && (
          <p
            className="text-xs"
            style={{ color: strVal.length >= field.recommendedMin ? '#16a34a' : '#7b7487' }}
          >
            建议至少 {field.recommendedMin} 字
          </p>
        )}
      </div>
    );
  }

  if (field.inputType === 'autocomplete') {
    const strVal = (value as string) ?? '';
    const [focused, setFocused] = useState(false);
    const filtered =
      focused && strVal.length > 0
        ? (field.suggestions ?? []).filter((s) =>
            s.includes(strVal),
          )
        : [];
    return (
      <div className="relative space-y-1">
        <input
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onNext) onNext();
          }}
          placeholder={field.placeholder}
          className={inputCls}
          style={{ color: '#121c28', boxShadow: '0 16px 32px -4px rgba(43, 138, 239, 0.08)' }}
        />
        {filtered.length > 0 && (
          <div
            className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto rounded-lg shadow-lg border"
            style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}
          >
            {filtered.slice(0, 8).map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={() => onChange(s)}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                style={{ color: '#121c28' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E8F4FF')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (field.inputType === 'textarea') {
    const strVal = (value as string) ?? '';
    return (
      <div className="space-y-2">
        <textarea
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          rows={3}
          className={`${inputCls} resize-y`}
          style={{ color: '#121c28', boxShadow: '0 16px 32px -4px rgba(43, 138, 239, 0.08)' }}
        />
        {field.maxLength != null && (
          <p className="text-xs text-right" style={{ color: '#7b7487' }}>
            {strVal.length}/{field.maxLength}
          </p>
        )}
      </div>
    );
  }

  if (field.inputType === 'choice' && field.choices) {
    const strVal = (value as string) ?? '';
    return (
      <motion.div
        className="grid gap-2"
        style={{ gridTemplateColumns: field.choices.length <= 4 ? '1fr 1fr' : '1fr 1fr 1fr' }}
      >
        {field.choices.map((c) => (
          <ChoiceCard
            key={c.value}
            label={c.label}
            selected={strVal === c.value}
            onClick={() => onChange(c.value)}
          />
        ))}
      </motion.div>
    );
  }

  if (field.inputType === 'tag-input') {
    const tags = (value as string[]) ?? [];
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [inputVal, setInputVal] = useState('');
    const maxItems = field.maxItems ?? 3;
    const itemMax = field.itemMaxLength ?? 15;

    const startEdit = (idx: number) => {
      setEditingIdx(idx);
      setInputVal(tags[idx] ?? '');
    };

    const confirmEdit = () => {
      if (editingIdx == null) return;
      const next = [...tags];
      if (inputVal.trim()) {
        next[editingIdx] = inputVal.trim();
      } else if (editingIdx === tags.length) {
        setEditingIdx(null);
        setInputVal('');
        return;
      }
      onChange(next.filter(Boolean));
      setEditingIdx(null);
      setInputVal('');
    };

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {tags.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => startEdit(i)}
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: 'rgba(43,138,239,0.1)', color: '#2B8AEF', border: '1px solid rgba(43,138,239,0.3)' }}
            >
              {t}
            </button>
          ))}
          {tags.length < maxItems && editingIdx == null && (
            <button
              type="button"
              onClick={() => startEdit(tags.length)}
              className="px-3 py-1.5 rounded-full text-xs transition-colors"
              style={{ color: '#7b7487', border: '1px solid #d9e3f4' }}
            >
              + 添加
            </button>
          )}
        </div>
        {editingIdx != null && (
          <div className="flex gap-2">
            <input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              maxLength={itemMax}
              placeholder={field.placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmEdit();
              }}
              className="flex-1 bg-white border-2 border-transparent rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2B8AEF] transition-all placeholder:text-[#ccc3d8]"
              style={{ color: '#121c28' }}
            />
            <button
              type="button"
              onClick={confirmEdit}
              className="px-3 py-2 rounded-lg text-xs font-medium"
              style={{ backgroundColor: 'rgba(43,138,239,0.15)', color: '#2B8AEF' }}
            >
              确定
            </button>
          </div>
        )}
        {editingIdx != null && (
          <div className="flex justify-between items-center">
            {field.recommendedMin != null ? (
              <p className="text-xs" style={{ color: inputVal.length >= field.recommendedMin ? '#16a34a' : '#7b7487' }}>
                建议至少 {field.recommendedMin} 字
              </p>
            ) : <span />}
            <p className="text-xs" style={{ color: '#7b7487' }}>
              {inputVal.length}/{itemMax}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (field.inputType === 'family-input') {
    const members = (value as FamilyMember[]) ?? [];
    const RELATION_OPTIONS: { value: FamilyMember['relation']; label: string }[] = [
      { value: 'father', label: '父亲' },
      { value: 'mother', label: '母亲' },
      { value: 'sibling', label: '兄弟姐妹' },
      { value: 'partner', label: '伴侣' },
      { value: 'other', label: '其他' },
    ];

    const addMember = () => {
      onChange([...members, { relation: 'other' as const, brief: '' }]);
    };

    const removeMember = (idx: number) => {
      onChange(members.filter((_, i) => i !== idx));
    };

    const updateMember = (idx: number, patch: Partial<FamilyMember>) => {
      const next = members.map((m, i) => (i === idx ? { ...m, ...patch } : m));
      onChange(next);
    };

    const selectCls =
      'bg-white border-2 border-transparent rounded-lg px-2 py-3 text-sm focus:outline-none focus:border-[#2B8AEF] transition-all min-w-[100px]';

    return (
      <div className="space-y-3">
        {members.map((m, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select
              value={m.relation}
              onChange={(e) =>
                updateMember(idx, { relation: e.target.value as FamilyMember['relation'] })
              }
              className={selectCls}
              style={{ color: '#121c28' }}
            >
              {RELATION_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <input
              value={m.brief}
              onChange={(e) => updateMember(idx, { brief: e.target.value })}
              placeholder={field.placeholder ?? '简短描述'}
              maxLength={20}
              className="flex-1 bg-white border-2 border-transparent rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-[#2B8AEF] transition-all placeholder:text-[#ccc3d8]"
              style={{ color: '#121c28' }}
            />
            <button
              type="button"
              onClick={() => removeMember(idx)}
              className="text-xs px-1 shrink-0 transition-colors"
              style={{ color: '#7b7487' }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addMember}
          className="w-full py-3 rounded-lg border-2 border-dashed text-sm transition-colors"
          style={{ borderColor: '#d9e3f4', color: '#7b7487' }}
        >
          + 添加家庭成员
        </button>
      </div>
    );
  }

  return null;
}
