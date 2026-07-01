/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Header } from '../shell/Header';
import { getApiBaseUrl } from '../../api/client';
import { useAvatar } from '../../api/settings';
import {
  type CloneBoundaries,
  forbiddenWordsToText,
  loadCloneMe,
  parseForbiddenWordsInput,
  pauseClone,
  resumeClone,
  updateCloneBoundaries,
  updateClonePersona,
} from '../../api/clone';
import { enqueuePostDraft } from '../../api/posts';
import { COPY } from '../../copy';
import { LottieLoader } from '../../components/LottieLoader';

const EMPTY_BOUNDARIES: CloneBoundaries = { forbiddenWords: [], topicsToAvoid: null };

const DRAFT_ERROR: Record<string, string> = {
  no_api: COPY.error.noApi,
  no_clone: '尚未创建分身，请先完成入驻',
  request_failed: '提交失败，请检查登录与 API',
};

export function CloneView({
  onPostQueued,
}: {
  onPostQueued?: (content: string) => void | Promise<void>;
}) {
  const [isActive, setIsActive] = useState(true);
  const [persona, setPersona] = useState<string | null>(null);
  const [boundaries, setBoundaries] = useState<CloneBoundaries>(EMPTY_BOUNDARIES);
  const [editing, setEditing] = useState(false);
  const [editingBoundaries, setEditingBoundaries] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftForbidden, setDraftForbidden] = useState('');
  const [draftTopics, setDraftTopics] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postHint, setPostHint] = useState('');
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postMessage, setPostMessage] = useState<string | null>(null);
  const [cloneLoading, setCloneLoading] = useState(true);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [interactionCount, setInteractionCount] = useState(0);
  const hasApi = Boolean(getApiBaseUrl());
  const avatarSrc = useAvatar();

  /** 清理 AI 生成的 persona 文本，去掉"好的，以下是…"等前缀 */
  const cleanPersonaText = (text: string | null): string | null => {
    if (!text) return null;
    // 去掉常见的 AI 回复前缀
    let cleaned = text
      .replace(/^好的，以下是根据.*?提炼出的角色设定\s*prompt[，,：:]?\s*(保留了.*?[：:])?\s*/s, '')
      .replace(/^以下是.*?角色设定[：:]\s*/s, '')
      .trim();
    // 如果清理后为空，返回原文
    return cleaned || text;
  };

  const applyClone = (c: {
    status: string;
    persona: string | null;
    boundaries: CloneBoundaries | null;
    interactionCount: number;
  }) => {
    setIsActive(c.status === 'active');
    setPersona(cleanPersonaText(c.persona));
    setBoundaries(c.boundaries ?? EMPTY_BOUNDARIES);
    setInteractionCount(c.interactionCount);
  };

  const fetchClone = useCallback(async () => {
    if (!hasApi) {
      setCloneLoading(false);
      return;
    }
    setCloneLoading(true);
    setCloneError(null);
    try {
      const c = await loadCloneMe();
      if (c) {
        applyClone(c);
      } else {
        setCloneError('尚未创建分身，请先完成入驻流程');
      }
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : COPY.error.cloneLoad);
    } finally {
      setCloneLoading(false);
    }
  }, [hasApi]);

  useEffect(() => {
    fetchClone();
  }, [fetchClone]);

  const startEdit = () => {
    setDraft(persona ?? '');
    setError(null);
    setEditingBoundaries(false);
    setEditing(true);
  };

  const startEditBoundaries = () => {
    setDraftForbidden(forbiddenWordsToText(boundaries.forbiddenWords));
    setDraftTopics(boundaries.topicsToAvoid ?? '');
    setError(null);
    setEditing(false);
    setEditingBoundaries(true);
  };

  const cancelEdit = () => {
    setDraft(persona ?? '');
    setError(null);
    setEditing(false);
  };

  const cancelEditBoundaries = () => {
    setDraftForbidden(forbiddenWordsToText(boundaries.forbiddenWords));
    setDraftTopics(boundaries.topicsToAvoid ?? '');
    setError(null);
    setEditingBoundaries(false);
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
      setError(COPY.error.saveFailed);
      return;
    }
    applyClone(updated);
    setEditing(false);
  };

  const saveBoundaries = async () => {
    const next: CloneBoundaries = {
      forbiddenWords: parseForbiddenWordsInput(draftForbidden),
      topicsToAvoid: draftTopics.trim() || null,
    };
    setError(null);
    if (!hasApi) {
      setBoundaries(next);
      setEditingBoundaries(false);
      return;
    }
    setSaving(true);
    const updated = await updateCloneBoundaries(next);
    setSaving(false);
    if (!updated) {
      setError(COPY.error.saveFailed);
      return;
    }
    applyClone(updated);
    setEditingBoundaries(false);
  };

  const toggle = async () => {
    if (!hasApi) {
      setIsActive(!isActive);
      return;
    }
    const next = isActive ? await pauseClone() : await resumeClone();
    if (next) applyClone(next);
  };

  const submitPost = async () => {
    setPostMessage(null);
    setError(null);
    if (!hasApi) {
      setPostMessage(COPY.error.noApiPost);
      return;
    }
    if (!isActive) {
      setError(COPY.error.cloneNotReady);
      return;
    }

    // 乐观更新：立即在本地显示帖子，不等后端
    const displayContent = postHint.trim() || '……';
    setPostHint('');
    setPostMessage(COPY.celebrate.postQueued);

    // 后端入队（后台执行，不阻塞 UI）
    enqueuePostDraft(postHint).then((result) => {
      if (!result.ok) {
        console.warn('[CloneView] post enqueue failed:', result);
      }
    });

    // 立即跳转 feed 并展示乐观帖
    await onPostQueued?.(displayContent);
  };

  const personaPreview = persona?.trim() || '尚未设置人格设定，点击下方编辑。';
  const boundarySummary =
    boundaries.forbiddenWords.length > 0
      ? `禁忌词 ${boundaries.forbiddenWords.length} 个`
      : '未设置禁忌词';
  const topicsPreview = boundaries.topicsToAvoid?.trim() || '未设置回避话题';

  return (
    <div className="pb-24 px-6">
      <Header title="我的分身" />

      {/* 加载中 */}
      {cloneLoading && (
        <div className="mt-16 flex flex-col items-center">
          <LottieLoader size={48} />
          <p className="text-sm text-gray-500 mt-4">{COPY.loading.cloneInfo}</p>
        </div>
      )}

      {/* 加载失败 */}
      {!cloneLoading && cloneError && (
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="text-sm text-red-400 mb-4">{cloneError}</p>
          <button
            type="button"
            onClick={fetchClone}
            className="px-4 py-2 rounded-xl bg-echo-blue/20 text-echo-blue text-sm"
          >
            {COPY.btn.tryAgain}
          </button>
        </div>
      )}

      {/* 正常显示 */}
      {!cloneLoading && !cloneError && (
      <div className="mt-8 flex flex-col items-center">
        <div
          className={`w-32 h-32 rounded-full border-4 ${isActive ? 'border-echo-blue echo-glow-blue' : 'border-gray-700'} flex items-center justify-center p-1 relative`}
        >
          <img
            src={avatarSrc}
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
          </p>
          {!editing && !editingBoundaries && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-3 text-left px-1">{personaPreview}</p>
          )}
        </div>

        <div className="mt-8 w-full grid grid-cols-2 gap-4">
          <div className="p-4 bg-echo-card rounded-2xl border border-white/5">
            <p className="text-xs text-gray-500 mb-1">人格设定</p>
            <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed">{personaPreview}</p>
          </div>
          <div className="p-4 bg-echo-card rounded-2xl border border-white/5">
            <p className="text-xs text-gray-500 mb-1">社交边界</p>
            <p className="text-xs text-echo-blue font-medium">{boundarySummary}</p>
            <p className="text-xs text-gray-400 line-clamp-2 mt-1">{topicsPreview}</p>
          </div>
          <div className="p-4 bg-echo-card rounded-2xl border border-white/5 col-span-2">
            <p className="text-xs text-gray-500 mb-1">累计社交</p>
            <p className="text-xl font-bold">
              {interactionCount.toLocaleString('en-US')}{' '}
              <span className="text-[10px] text-gray-500 font-normal">次互动</span>
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
                {saving ? COPY.submitting.save : COPY.btn.save}
              </button>
            </div>
          </div>
        )}

        {editingBoundaries && (
          <div className="mt-6 w-full text-left space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">编辑社交边界</p>
            <div>
              <p className="text-xs text-gray-500 mb-1">禁忌词（每行一词，或用逗号分隔）</p>
              <textarea
                value={draftForbidden}
                onChange={(e) => setDraftForbidden(e.target.value)}
                placeholder={'例如：政治\n借钱\n脏话'}
                rows={4}
                disabled={saving}
                className="w-full bg-echo-card border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 disabled:opacity-60"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">回避话题（可选）</p>
              <textarea
                value={draftTopics}
                onChange={(e) => setDraftTopics(e.target.value)}
                placeholder="例如：不谈前任、不索要联系方式"
                rows={2}
                disabled={saving}
                className="w-full bg-echo-card border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 disabled:opacity-60"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelEditBoundaries}
                disabled={saving}
                className="flex-1 py-3 bg-white/5 rounded-2xl font-bold text-sm border border-white/5 text-gray-400 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void saveBoundaries()}
                disabled={saving}
                className="flex-1 py-3 bg-echo-blue text-echo-dark rounded-2xl font-bold text-sm disabled:opacity-50"
              >
                {saving ? COPY.submitting.save : COPY.btn.save}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 w-full space-y-3">
          {!editing && !editingBoundaries && (
            <>
              <div className="p-4 bg-echo-card rounded-2xl border border-white/5 text-left space-y-3">
                <p className="text-xs text-gray-500 leading-relaxed">
                  分身运行中时，会按空闲节奏自动发帖。
                </p>
                <div>
                  <p className="text-xs text-gray-500 mb-1">发帖提示（可选）</p>
                  <textarea
                    value={postHint}
                    onChange={(e) => setPostHint(e.target.value)}
                    placeholder="留空则由分身根据人格自动生成…"
                    rows={2}
                    disabled={!isActive}
                    className="w-full bg-echo-dark border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 disabled:opacity-50"
                  />
                </div>
                {postMessage && <p className="text-xs text-emerald-400">{postMessage}</p>}
                <button
                  type="button"
                  onClick={() => void submitPost()}
                  disabled={!hasApi ? false : !isActive}
                  className="w-full py-3 bg-echo-blue text-echo-dark rounded-2xl font-bold text-sm disabled:opacity-50"
                >
                  {COPY.btn.postAsClone}
                </button>
                {!isActive && hasApi && (
                  <p className="text-[10px] text-amber-400/90">{COPY.error.cloneSleeping}</p>
                )}
              </div>
              <button
                type="button"
                onClick={startEdit}
                className="w-full py-4 bg-white/5 rounded-2xl font-bold text-sm border border-white/5"
              >
                {COPY.btn.editPersona}
              </button>
              <button
                type="button"
                onClick={startEditBoundaries}
                className="w-full py-4 bg-white/5 rounded-2xl font-bold text-sm border border-white/5"
              >
                {COPY.btn.editBoundaries}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => void toggle()}
            disabled={editing || editingBoundaries}
            className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
              isActive
                ? 'bg-echo-card text-red-500 border border-red-500/30'
                : 'bg-echo-blue text-echo-dark'
            }`}
          >
            {isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            {isActive ? COPY.btn.pauseClone : COPY.btn.startClone}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
