/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, Check } from 'lucide-react';
import { getProfile, updateProfile, notifyProfileUpdated, type MatchPrefs } from '../../api/settings';
import { COPY } from '../../copy';

const GENDER_OPTIONS = [
  { value: 'female', label: '女生' },
  { value: 'male', label: '男生' },
  { value: 'any', label: '不限' },
];

const AGE_OPTIONS = [
  '18-22', '22-26', '26-30', '30-36', '36-46', '46+',
];

const OCCUPATION_OPTIONS = [
  '互联网/科技', '金融/投资', '教育/学术', '医疗/健康',
  '设计/创意', '媒体/传播', '法律/咨询', '商业/创业',
  '艺术/文化', '其他',
];

const GOAL_OPTIONS = [
  { value: '认真约会', label: '认真约会' },
  { value: '先交朋友', label: '先交朋友' },
  { value: '慢慢来', label: '慢慢来，看看感觉' },
  { value: '自我探索', label: '自我探索' },
];

const CITY_OPTIONS = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京',
  '重庆', '西安', '长沙', '苏州', '天津', '青岛', '大连', '厦门',
  '郑州', '合肥', '福州', '昆明', '贵阳', '哈尔滨', '沈阳', '济南',
  '石家庄', '太原', '兰州', '海口', '呼和浩特', '拉萨', '银川', '西宁',
  '南宁', '长春', '乌鲁木齐', '珠海',
];

type SingleKey = 'preferredGender' | 'preferredCity';
type MultiKey = 'preferredAgeBand' | 'preferredOccupation';
type FieldKey = SingleKey | MultiKey | 'relationshipIntent';

export function MatchPrefsSettings({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = useState<MatchPrefs>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await getProfile();
      if (r.ok) {
        const loaded: MatchPrefs = r.data.matchPrefs ?? {};
        // 如果 relationshipIntent 未设置，用 Phase0 的 goalOnEcho 作为默认值
        if (!loaded.relationshipIntent && r.data.goalOnEcho) {
          loaded.relationshipIntent = r.data.goalOnEcho;
        }
        setPrefs(loaded);
      }
    })();
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    const r = await updateProfile({ matchPrefs: prefs });
    setSaving(false);
    if (r.ok) {
      setSaved(true);
      // 通知 SettingsView 刷新（即使其当前未挂载，重挂载时也会从缓存秒显 + 自动刷新）
      notifyProfileUpdated();
      setTimeout(onBack, 600);
    } else {
      const err = r as { ok: false; status: number; message: string };
      setError(err.message || COPY.error.saveFailed);
    }
  }, [prefs, onBack]);

  const updateSingle = (key: SingleKey | 'relationshipIntent', value: string) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const toggleMulti = (key: MultiKey, value: string) => {
    setPrefs((prev) => {
      const arr = (prev[key] ?? []) as string[];
      const next = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      return { ...prev, [key]: next };
    });
    setSaved(false);
  };

  /* ─── 渲染 helper ─── */

  const renderSingleChoice = (
    key: SingleKey | 'relationshipIntent',
    options: { value: string; label: string }[],
  ) => (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = prefs[key] === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => updateSingle(key, opt.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all`}
            style={active
              ? { backgroundColor: '#2B8AEF', color: '#ffffff' }
              : { backgroundColor: '#ffffff', border: '1px solid #d9e3f4', color: '#121c28' }
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const renderMultiChoice = (key: MultiKey, options: { value: string; label: string }[]) => {
    const selected = (prefs[key] ?? []) as string[];
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleMulti(key, opt.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all`}
              style={active
                ? { backgroundColor: '#2B8AEF', color: '#ffffff' }
                : { backgroundColor: '#ffffff', border: '1px solid #d9e3f4', color: '#121c28' }
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="fixed inset-0 z-[100] flex justify-center"
    >
      <div className="w-full max-w-[375px] flex flex-col h-full relative" style={{ backgroundColor: '#f8f9ff' }}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-14" style={{ borderBottom: '1px solid #d9e3f4' }}>
        <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-xl active:opacity-80" style={{ color: '#121c28' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold" style={{ color: '#121c28' }}>匹配偏好</h1>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* 交友目的 */}
        <div>
          <p className="text-xs mb-2 font-medium" style={{ color: '#7b7487' }}>交友目的</p>
          {renderSingleChoice('relationshipIntent', GOAL_OPTIONS)}
        </div>

        {/* 期望性别 */}
        <div>
          <p className="text-xs mb-2 font-medium" style={{ color: '#7b7487' }}>期望性别</p>
          {renderSingleChoice('preferredGender', GENDER_OPTIONS)}
        </div>

        {/* 期望年龄段（多选） */}
        <div>
          <p className="text-xs mb-2 font-medium" style={{ color: '#7b7487' }}>期望年龄段</p>
          <p className="text-[10px] mb-2" style={{ color: '#7b7487' }}>可多选</p>
          {renderMultiChoice(
            'preferredAgeBand',
            AGE_OPTIONS.map((a) => ({ value: a, label: `${a}岁` })),
          )}
        </div>

        {/* 期望城市 */}
        <div>
          <p className="text-xs mb-2 font-medium" style={{ color: '#7b7487' }}>期望城市</p>
          <input
            type="text"
            value={prefs.preferredCity ?? ''}
            onChange={(e) => {
              updateSingle('preferredCity', e.target.value);
              setCityQuery(e.target.value);
            }}
            placeholder="输入城市名搜索…"
            className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
            style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4', color: '#121c28' }}
          />
          {cityQuery.length > 0 && (
            <div className="mt-1 max-h-40 overflow-y-auto rounded-xl" style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4' }}>
              {CITY_OPTIONS
                .filter((c) => c.includes(cityQuery))
                .slice(0, 8)
                .map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      updateSingle('preferredCity', c);
                      setCityQuery('');
                    }}
                    className="w-full text-left px-4 py-2 text-sm transition-colors"
                    style={{ color: '#121c28' }}
                  >
                    {c}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* 期望职业/领域（多选） */}
        <div>
          <p className="text-xs mb-2 font-medium" style={{ color: '#7b7487' }}>期望职业/领域</p>
          <p className="text-[10px] mb-2" style={{ color: '#7b7487' }}>可多选</p>
          {renderMultiChoice(
            'preferredOccupation',
            OCCUPATION_OPTIONS.map((o) => ({ value: o, label: o })),
          )}
        </div>

        {error && <p className="text-sm" style={{ color: '#ba1a1a' }}>{error}</p>}
      </div>

      {/* Save bar */}
      <div className="shrink-0 px-5 py-4" style={{ borderTop: '1px solid #d9e3f4' }}>
        <button
          type="button"
          disabled={saving || saved}
          onClick={handleSave}
          className="w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50 transition-all"
          style={{ backgroundColor: '#2B8AEF', color: '#ffffff' }}
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : saved ? (
            <>
              <Check className="w-5 h-5" /> {COPY.celebrate.prefsSaved}
            </>
          ) : (
            '保存偏好'
          )}
        </button>
      </div>
      </div>
    </motion.div>
  );
}
