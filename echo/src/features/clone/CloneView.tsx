/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Header } from '../shell/Header';
import { getApiBaseUrl } from '../../api/client';
import { loadCloneMe, pauseClone, resumeClone, updateClonePersona } from '../../api/clone';

export function CloneView() {
  const [isActive, setIsActive] = useState(true);
  const [persona, setPersona] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasApi = Boolean(getApiBaseUrl());

  useEffect(() => {
    if (!hasApi) return;
    void loadCloneMe().then((c) => {
      if (!c) return;
      setIsActive(c.status === 'active');
      setPersona(c.persona);
    });
  }, [hasApi]);

  const startEdit = () => {
    setDraft(persona ?? '');
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(persona ?? '');
    setError(null);
    setEditing(false);
  };

  const savePersona = async () => {
    const text = draft.trim();
    if (!text) {
      setError('人格设定不能为空');
      return;
    }
    setError(null);
    if (!hasApi) {
      setPersona(text);
      setEditing(false);
      return;
    }
    setSaving(true);
    const updated = await updateClonePersona(text);
    setSaving(false);
    if (!updated) {
      setError('保存失败，请稍后重试');
      return;
    }
    setPersona(updated.persona);
    setIsActive(updated.status === 'active');
    setEditing(false);
  };

  const toggle = async () => {
    if (!hasApi) {
      setIsActive(!isActive);
      return;
    }
    const next = isActive ? await pauseClone() : await resumeClone();
    if (next) {
      setIsActive(next.status === 'active');
      setPersona(next.persona);
    }
  };

  const personaPreview = persona?.trim() || '尚未设置人格设定，点击下方编辑。';

  return (
    <div className="pb-24 px-6">
      <Header title="我的分身" />

      <div className="mt-8 flex flex-col items-center">
        <div
          className={`w-32 h-32 rounded-full border-4 ${isActive ? 'border-echo-blue echo-glow-blue' : 'border-gray-700'} flex items-center justify-center p-1 relative`}
        >
          <img
            src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix"
            alt="My Clone"
            className={`w-full h-full rounded-full transition-opacity ${isActive ? 'opacity-100' : 'opacity-40 grayscale'}`}
          />
          <div
            className={`absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-echo-blue text-echo-dark' : 'bg-gray-600 text-white'}`}
          >
            {isActive ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
          </div>
        </div>

        <div className="mt-4 text-center w-full max-w-sm">
          <h2 className="text-2xl font-bold">我的分身</h2>
          <p className="text-echo-blue text-sm font-medium">
            状态：{isActive ? '正在学习与社交' : '休眠中'}
            {!hasApi && '（Mock）'}
          </p>
          {!editing && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-3 text-left px-1">{personaPreview}</p>
          )}
        </div>

        <div className="mt-8 w-full grid grid-cols-2 gap-4">
          <div className="p-4 bg-echo-card rounded-2xl border border-white/5 col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-500 mb-1">人格设定</p>
            <p className="text-xs text-gray-300 line-clamp-4 leading-relaxed">{personaPreview}</p>
          </div>
          <div className="p-4 bg-echo-card rounded-2xl border border-white/5">
            <p className="text-xs text-gray-500 mb-1">累计社交</p>
            <p className="text-xl font-bold">
              1,248 <span className="text-[10px] text-gray-500 font-normal">次互动</span>
            </p>
          </div>
        </div>

        {editing && (
          <div className="mt-6 w-full text-left space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">编辑人格设定</p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="描述分身的语气、兴趣与禁忌…"
              rows={6}
              disabled={saving}
              className="w-full bg-echo-card border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 disabled:opacity-60"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="flex-1 py-3 bg-white/5 rounded-2xl font-bold text-sm border border-white/5 text-gray-400 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void savePersona()}
                disabled={saving}
                className="flex-1 py-3 bg-echo-blue text-echo-dark rounded-2xl font-bold text-sm disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 w-full space-y-3">
          {!editing && (
            <button
              type="button"
              onClick={startEdit}
              className="w-full py-4 bg-white/5 rounded-2xl font-bold text-sm border border-white/5"
            >
              编辑人格设定
            </button>
          )}

          <button
            type="button"
            onClick={() => void toggle()}
            className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
              isActive
                ? 'bg-echo-card text-red-500 border border-red-500/30'
                : 'bg-echo-blue text-echo-dark'
            }`}
          >
            {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isActive ? '暂停分身' : '启动分身'}
          </button>

          <button
            type="button"
            className="w-full py-4 bg-white/5 rounded-2xl font-bold text-sm border border-white/5 text-gray-500"
          >
            编辑社交边界 (禁忌词)
          </button>
        </div>
      </div>
    </div>
  );
}
