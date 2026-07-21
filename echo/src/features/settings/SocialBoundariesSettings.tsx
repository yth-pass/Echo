/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, Check } from 'lucide-react';
import {
  getSocialBoundaries,
  saveSocialBoundaries,
  notifyProfileUpdated,
  type SocialBoundaries,
} from '../../api/settings';
import { parseForbiddenWordsInput, forbiddenWordsToText } from '../../api/clone';
import { COPY } from '../../copy';

const EMPTY: SocialBoundaries = { forbiddenWords: [], topicsToAvoid: null };

export function SocialBoundariesSettings({ onBack }: { onBack: () => void }) {
  const [boundaries, setBoundaries] = useState<SocialBoundaries>(EMPTY);
  const [draftForbidden, setDraftForbidden] = useState('');
  const [draftTopics, setDraftTopics] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始加载：GET /clones/me → boundaries
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const r = await getSocialBoundaries();
      if (cancelled) return;
      if (r.ok) {
        setBoundaries(r.data);
        setDraftForbidden(forbiddenWordsToText(r.data.forbiddenWords));
        setDraftTopics(r.data.topicsToAvoid ?? '');
      } else {
        // 无分身或网络错误：显示空表单，保存时再报错
        setBoundaries(EMPTY);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    const next: SocialBoundaries = {
      forbiddenWords: parseForbiddenWordsInput(draftForbidden),
      topicsToAvoid: draftTopics.trim() || null,
    };
    setSaving(true);
    const r = await saveSocialBoundaries(next);
    setSaving(false);
    if (r.ok) {
      setBoundaries(r.data);
      setSaved(true);
      notifyProfileUpdated();
      setTimeout(onBack, 600);
    } else {
      const err = r as { ok: false; status: number; message: string };
      setError(err.message === 'no-clone' ? '分身尚未创建，请先完成入驻' : COPY.error.saveFailed);
    }
  }, [draftForbidden, draftTopics, onBack]);

  const dirty =
    draftForbidden !== forbiddenWordsToText(boundaries.forbiddenWords) ||
    draftTopics !== (boundaries.topicsToAvoid ?? '');

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
          <h1 className="text-base font-bold" style={{ color: '#121c28' }}>社交边界</h1>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#7b7487' }} />
            </div>
          ) : (
            <>
              {/* 说明 */}
              <p className="text-xs leading-relaxed" style={{ color: '#7b7487' }}>
                为你的分身设定对话边界。分身在与他人交流时会主动回避这些词和话题。
              </p>

              {/* 禁忌词 */}
              <div>
                <p className="text-xs mb-1 font-medium" style={{ color: '#7b7487' }}>禁忌词</p>
                <p className="text-[10px] mb-2" style={{ color: '#7b7487' }}>每行一个词，或用逗号 / 顿号分隔</p>
                <textarea
                  value={draftForbidden}
                  onChange={(e) => { setDraftForbidden(e.target.value); setSaved(false); }}
                  placeholder={'例如：\n政治\n借钱\n脏话'}
                  rows={5}
                  disabled={saving}
                  className="w-full rounded-xl px-4 py-2.5 text-sm disabled:opacity-60 focus:outline-none"
                  style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4', color: '#121c28' }}
                />
                {boundaries.forbiddenWords.length > 0 && draftForbidden === forbiddenWordsToText(boundaries.forbiddenWords) && (
                  <p className="text-[10px] mt-1" style={{ color: '#7b7487' }}>
                    当前共 {boundaries.forbiddenWords.length} 个禁忌词
                  </p>
                )}
              </div>

              {/* 回避话题 */}
              <div>
                <p className="text-xs mb-1 font-medium" style={{ color: '#7b7487' }}>回避话题</p>
                <p className="text-[10px] mb-2" style={{ color: '#7b7487' }}>用自然语言描述分身应回避的话题</p>
                <textarea
                  value={draftTopics}
                  onChange={(e) => { setDraftTopics(e.target.value); setSaved(false); }}
                  placeholder="例如：不谈前任、不索要联系方式、不讨论收入"
                  rows={3}
                  disabled={saving}
                  className="w-full rounded-xl px-4 py-2.5 text-sm disabled:opacity-60 focus:outline-none"
                  style={{ backgroundColor: '#ffffff', border: '1px solid #d9e3f4', color: '#121c28' }}
                />
              </div>

              {error && <p className="text-sm" style={{ color: '#ba1a1a' }}>{error}</p>}
            </>
          )}
        </div>

        {/* Save bar */}
        <div className="shrink-0 px-5 py-4" style={{ borderTop: '1px solid #d9e3f4' }}>
          <button
            type="button"
            disabled={saving || saved || loading || !dirty}
            onClick={() => void handleSave()}
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
              COPY.btn.save
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
