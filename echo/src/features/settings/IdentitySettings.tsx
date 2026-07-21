/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, Check, X } from 'lucide-react';
import { getProfile, updateProfile, notifyProfileUpdated, type IdentityData } from '../../api/settings';
import { COPY } from '../../copy';

/* ─── 选项常量（与 phase0-fields.data.ts 保持一致） ─── */

const GENDER_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'nonbinary', label: '非二元' },
  { value: 'unspecified', label: '不想说' },
];

const AGE_OPTIONS = [
  { value: '18-22', label: '18-22' },
  { value: '23-27', label: '23-27' },
  { value: '28-32', label: '28-32' },
  { value: '33-38', label: '33-38' },
  { value: '39-45', label: '39-45' },
  { value: '46+', label: '46+' },
];

const EDUCATION_OPTIONS = [
  { value: 'highschool', label: '高中 / 中专' },
  { value: 'college', label: '大专' },
  { value: 'bachelor', label: '本科' },
  { value: 'master', label: '硕士' },
  { value: 'phd', label: '博士' },
];

const OCCUPATION_OPTIONS = [
  { value: '互联网/科技', label: '互联网 / 科技' },
  { value: '金融', label: '金融' },
  { value: '教育', label: '教育' },
  { value: '医疗/健康', label: '医疗 / 健康' },
  { value: '设计/创意', label: '设计 / 创意' },
  { value: '媒体/传播', label: '媒体 / 传播' },
  { value: '法律/咨询', label: '法律 / 咨询' },
  { value: '制造业/工程', label: '制造业 / 工程' },
  { value: '学生', label: '学生' },
  { value: '其他', label: '其他' },
];

const INDUSTRY_OPTIONS = [
  { value: '互联网/科技', label: '互联网/科技' },
  { value: '金融/投资', label: '金融/投资' },
  { value: '教育/学术', label: '教育/学术' },
  { value: '医疗/健康', label: '医疗/健康' },
  { value: '公务员/事业单位', label: '公务员/事业单位' },
  { value: '媒体/内容', label: '媒体/内容' },
  { value: '创业', label: '创业' },
  { value: '学生', label: '学生' },
  { value: '自由职业', label: '自由职业' },
  { value: '制造/工程', label: '制造/工程' },
  { value: '文化/艺术', label: '文化/艺术' },
  { value: '其他', label: '其他' },
];

const ENTREPRENEURSHIP_OPTIONS = [
  { value: '科技/互联网', label: '科技 / 互联网' },
  { value: '消费品/零售', label: '消费品 / 零售' },
  { value: '教育/培训', label: '教育 / 培训' },
  { value: '医疗/健康', label: '医疗 / 健康' },
  { value: '金融/投资', label: '金融 / 投资' },
  { value: '文化/创意', label: '文化 / 创意' },
  { value: '餐饮/食品', label: '餐饮 / 食品' },
  { value: '制造/硬件', label: '制造 / 硬件' },
  { value: '其他', label: '其他' },
];

const GOAL_OPTIONS = [
  { value: '认真约会', label: '认真约会' },
  { value: '先交朋友', label: '先交朋友' },
  { value: '慢慢来', label: '慢慢来，看看感觉' },
  { value: '自我探索', label: '自我探索' },
];

const MAJOR_CITIES = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '重庆', '武汉',
  '南京', '西安', '苏州', '天津', '长沙', '郑州', '青岛', '大连',
  '厦门', '宁波', '东莞', '佛山', '昆明', '合肥', '福州', '哈尔滨',
  '济南', '沈阳', '贵阳', '太原', '石家庄', '兰州', '海口', '拉萨',
  '呼和浩特', '南宁', '银川', '西宁', '乌鲁木齐',
];

/* ─── 类型 ─── */

type IdentityFormState = {
  displayName: string;
  genderIdentity: string;
  ageBand: string;
  hometownCity: string;
  currentCity: string;
  education: string;
  occupation: string;
  industry: string;
  entrepreneurshipField: string;
  workDescription: string;
  keyLifeExperiences: string[];
  selfIntroOneLiner: string;
  goalOnEcho: string;
};

const EMPTY_FORM: IdentityFormState = {
  displayName: '',
  genderIdentity: '',
  ageBand: '',
  hometownCity: '',
  currentCity: '',
  education: '',
  occupation: '',
  industry: '',
  entrepreneurshipField: '',
  workDescription: '',
  keyLifeExperiences: [],
  selfIntroOneLiner: '',
  goalOnEcho: '',
};

function identityToForm(id: IdentityData | null | undefined): IdentityFormState {
  if (!id) return { ...EMPTY_FORM };
  return {
    displayName: id.displayName ?? '',
    genderIdentity: id.genderIdentity ?? '',
    ageBand: id.ageBand ?? '',
    hometownCity: id.hometownCity ?? '',
    currentCity: id.currentCity ?? '',
    education: id.education ?? '',
    occupation: id.occupation ?? '',
    industry: id.industry ?? '',
    entrepreneurshipField: id.entrepreneurshipField ?? '',
    workDescription: id.workDescription ?? '',
    keyLifeExperiences: id.keyLifeExperiences ?? [],
    selfIntroOneLiner: id.selfIntroOneLiner ?? '',
    goalOnEcho: id.goalOnEcho ?? '',
  };
}

/* ─── 组件 ─── */

export function IdentitySettings({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState<IdentityFormState>({ ...EMPTY_FORM });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hometownQuery, setHometownQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');

  useEffect(() => {
    void (async () => {
      const r = await getProfile();
      if (r.ok) {
        setForm(identityToForm(r.data.identity));
      }
    })();
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);

    // 构建 identity payload，只发送有值的字段
    const identity: Partial<IdentityData> = {};
    if (form.displayName) identity.displayName = form.displayName;
    if (form.genderIdentity) identity.genderIdentity = form.genderIdentity;
    if (form.ageBand) identity.ageBand = form.ageBand;
    if (form.hometownCity) identity.hometownCity = form.hometownCity;
    if (form.currentCity) identity.currentCity = form.currentCity;
    if (form.education) identity.education = form.education;
    if (form.occupation) identity.occupation = form.occupation;
    if (form.industry) identity.industry = form.industry;
    if (form.industry === '创业' && form.entrepreneurshipField) {
      identity.entrepreneurshipField = form.entrepreneurshipField;
    }
    if (form.workDescription) identity.workDescription = form.workDescription;
    if (form.keyLifeExperiences.length > 0) {
      identity.keyLifeExperiences = form.keyLifeExperiences;
    }
    if (form.selfIntroOneLiner) identity.selfIntroOneLiner = form.selfIntroOneLiner;
    if (form.goalOnEcho) identity.goalOnEcho = form.goalOnEcho;

    const r = await updateProfile({ identity });
    setSaving(false);
    if (r.ok) {
      setSaved(true);
      notifyProfileUpdated();
      setTimeout(onBack, 600);
    } else {
      const err = r as { ok: false; status: number; message: string };
      setError(err.message || COPY.error.saveFailed);
    }
  }, [form, onBack]);

  const update = <K extends keyof IdentityFormState>(key: K, value: IdentityFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  /* ─── 渲染 helpers ─── */

  const renderSection = (title: string, children: React.ReactNode) => (
    <div>
      <p className="text-xs mb-2 font-medium" style={{ color: '#7b7487' }}>{title}</p>
      {children}
    </div>
  );

  const renderSingleChoice = (
    key: keyof IdentityFormState,
    options: { value: string; label: string }[],
  ) => (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = form[key] === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => update(key, opt.value)}
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

  const renderTextInput = (
    key: 'displayName' | 'workDescription' | 'selfIntroOneLiner',
    placeholder: string,
    maxLength?: number,
  ) => (
    <input
      type="text"
      value={form[key]}
      onChange={(e) => update(key, e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
      style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4', color: '#121c28' }}
    />
  );

  const renderCityAutocomplete = (
    key: 'hometownCity' | 'currentCity',
    query: string,
    setQuery: (v: string) => void,
    placeholder: string,
  ) => (
    <>
      <input
        type="text"
        value={form[key] || query}
        onChange={(e) => {
          update(key, e.target.value);
          setQuery(e.target.value);
        }}
        onFocus={() => setQuery('')}
        placeholder={placeholder}
        className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none"
        style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4', color: '#121c28' }}
      />
      {(query.length > 0 || !form[key]) && query.length > 0 && (
        <div className="mt-1 max-h-32 overflow-y-auto rounded-xl" style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4' }}>
          {MAJOR_CITIES
            .filter((c) => c.includes(query))
            .slice(0, 6)
            .map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  update(key, c);
                  setQuery('');
                }}
                className="w-full text-left px-4 py-2 text-sm transition-colors"
                style={{ color: '#121c28' }}
              >
                {c}
              </button>
            ))}
        </div>
      )}
    </>
  );

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (trimmed.length < 2) return;
    if (form.keyLifeExperiences.length >= 3) return;
    if (form.keyLifeExperiences.includes(trimmed)) return;
    update('keyLifeExperiences', [...form.keyLifeExperiences, trimmed]);
    setTagInput('');
    setSaved(false);
  };

  const removeTag = (idx: number) => {
    update('keyLifeExperiences', form.keyLifeExperiences.filter((_, i) => i !== idx));
    setSaved(false);
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
          <h1 className="text-base font-bold" style={{ color: '#121c28' }}>基础信息</h1>
          <span className="text-[10px] ml-auto" style={{ color: '#7b7487' }}>注册时填写的信息</span>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* 称呼 */}
          {renderSection('称呼', renderTextInput('displayName', '你希望怎么被称呼？', 20))}

          {/* 性别 */}
          {renderSection('性别认同', renderSingleChoice('genderIdentity', GENDER_OPTIONS))}

          {/* 年龄段 */}
          {renderSection(
            '年龄段',
            renderSingleChoice('ageBand', AGE_OPTIONS),
          )}

          {/* 成长城市 */}
          {renderSection(
            '成长城市',
            renderCityAutocomplete('hometownCity', hometownQuery, setHometownQuery, '你在哪个城市长大？'),
          )}

          {/* 现居城市 */}
          {renderSection(
            '现居城市',
            renderCityAutocomplete('currentCity', cityQuery, setCityQuery, '你现在住在哪个城市？'),
          )}

          {/* 教育程度 */}
          {renderSection('最高教育程度', renderSingleChoice('education', EDUCATION_OPTIONS))}

          {/* 职业 */}
          {renderSection('职业 / 领域', renderSingleChoice('occupation', OCCUPATION_OPTIONS))}

          {/* 行业 */}
          {renderSection('所在行业', renderSingleChoice('industry', INDUSTRY_OPTIONS))}

          {/* 创业领域（条件显示） */}
          {form.industry === '创业' &&
            renderSection(
              '创业领域',
              renderSingleChoice('entrepreneurshipField', ENTREPRENEURSHIP_OPTIONS),
            )}

          {/* 工作描述 */}
          {renderSection(
            '工作描述',
            renderTextInput('workDescription', '简短描述即可', 20),
          )}

          {/* 关键人生经历 */}
          {renderSection(
            '关键人生经历',
            <div>
              <p className="text-[10px] mb-2" style={{ color: '#7b7487' }}>最多 3 条，每条 2-80 字</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.keyLifeExperiences.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                    style={{ backgroundColor: 'rgba(43,138,239,0.12)', color: '#2B8AEF' }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(idx)}
                      className="transition-colors"
                      style={{ color: '#2B8AEF' }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              {form.keyLifeExperiences.length < 3 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="比如：gap year"
                    maxLength={80}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4', color: '#121c28' }}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    disabled={!tagInput.trim()}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium active:opacity-80 disabled:opacity-30 transition-all"
                    style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4', color: '#121c28' }}
                  >
                    添加
                  </button>
                </div>
              )}
            </div>,
          )}

          {/* 一句话自我介绍 */}
          {renderSection(
            '一句话自我介绍',
            renderTextInput('selfIntroOneLiner', '一个喜欢发呆的程序员', 30),
          )}

          {/* Echo 目标 */}
          {renderSection('注册 Echo 的目标', renderSingleChoice('goalOnEcho', GOAL_OPTIONS))}

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
              '保存修改'
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
