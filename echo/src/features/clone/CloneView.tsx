/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../shell/Header';
import { getApiBaseUrl } from '../../api/client';
import { useAvatar } from '../../api/settings';
import {
  type CloneBoundaries,
  type CloneMe,
  type PersonaSketchSection,
  type ScenarioCardItem,
  forbiddenWordsToText,
  loadCloneMe,
  parseForbiddenWordsInput,
  pauseClone,
  resumeClone,
  updateCloneBoundaries,
} from '../../api/clone';
import { enqueuePostDraft, getMyPosts, updatePost, deletePost } from '../../api/posts';
import { COPY } from '../../copy';
import { LottieLoader } from '../../components/LottieLoader';

const EMPTY_BOUNDARIES: CloneBoundaries = { forbiddenWords: [], topicsToAvoid: null };

// 默认头像按性别（用户未上传时使用，已上传则 useAvatar 返回上传图）
const MALE_AVATAR = '/illustrations/set2-wink.png';
const FEMALE_AVATAR = '/illustrations/pink-set2-wink.png';

// 自动发帖说明文案（v1.2 更新）
const AUTO_POST_HINT =
  '72小时内未主动发帖时，分身会根据您的聊天内容和人格信息自动生成帖子。自动生成的帖子允许您编辑后发布。';

// relationshipIntent → 展示文案（后端值不固定，做一次友好映射）
const INTENT_LABEL: Record<string, string> = {
  love: '恋爱',
  friend: '先交朋友',
  slow: '慢慢来',
  explore: '自我探索',
  '找对象': '恋爱',
  '交友': '先交朋友',
  '脱单': '恋爱',
};

function intentLabel(intent: string | null): string {
  if (!intent) return '自由探索';
  return INTENT_LABEL[intent] ?? intent;
}

/** 相对时间：刚刚 / N分钟前 / N小时前 / N天前 / 日期 */
function relativeTime(iso: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 0) return '刚刚';
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

/**
 * 清理 AI 生成的 persona 文本，去掉"好的，以下是…""这是一个…的角色设定"等前缀。
 * v1.2 增强：覆盖更多变体 + 关键词二次清理。
 */
function cleanPersonaText(text: string | null): string | null {
  if (!text) return null;
  let cleaned = text;
  // 第一轮：去掉常见 AI 回复前缀（多种变体）
  cleaned = cleaned
    .replace(/^[\s]*好的[，,！!。.\s]*以下是[^。\n]*?(角色设定|人设|人物画像|prompt)[^。\n]*?[：:，,]?\s*/s, '')
    .replace(/^[\s]*以下是[^。\n]*?(角色设定|人设|人物画像|prompt)[：:]\s*/s, '')
    .replace(/^[\s]*这是一个[^。\n]*?(角色|人设|人物)[^。\n]*?[：:，,]?\s*/s, '')
    .replace(/^[\s]*根据您[^。\n]*?提炼[^。\n]*?[：:，,]?\s*/s, '')
    .replace(/^[\s]*(基于|结合)[^。\n]*?生成[^。\n]*?[：:，,]?\s*/s, '')
    // 去掉残留的"保留了…："括注
    .replace(/^[（(]?保留了[^)）]*[)）]?[：:]?\s*/s, '')
    .trim();
  // 第二轮：如果仍含 prompt / 角色设定 等关键词且位于开头，继续剥离
  if (/^(prompt|角色设定|人设|人物画像)[：:]/i.test(cleaned)) {
    cleaned = cleaned.replace(/^(prompt|角色设定|人设|人物画像)[：:]\s*/i, '').trim();
  }
  return cleaned || text;
}

export function CloneView({
  onPostQueued,
  headerRight,
}: {
  onPostQueued?: (content: string) => void | Promise<void>;
  headerRight?: ReactNode;
}) {
  const [isActive, setIsActive] = useState(true);
  const [persona, setPersona] = useState<string | null>(null);
  const [boundaries, setBoundaries] = useState<CloneBoundaries>(EMPTY_BOUNDARIES);
  const [gender, setGender] = useState<string | null>(null);
  const [relationshipIntent, setRelationshipIntent] = useState<string | null>(null);
  const [scenarioCards, setScenarioCards] = useState<ScenarioCardItem[] | null>(null);
  const [personaSketchSections, setPersonaSketchSections] = useState<PersonaSketchSection[] | null>(null);
  const [idealPartnerNarrative, setIdealPartnerNarrative] = useState<string | null>(null);
  const [idealPartnerCardsAnswered, setIdealPartnerCardsAnswered] = useState(false);
  const [socialStats, setSocialStats] = useState({ postCount: 0, commentCount: 0, matchCount: 0 });
  const [posts, setPosts] = useState<CloneMe['posts']>([]);

  const [editingBoundaries, setEditingBoundaries] = useState(false);
  const [draftForbidden, setDraftForbidden] = useState('');
  const [draftTopics, setDraftTopics] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [postHint, setPostHint] = useState('');
  const [postMessage, setPostMessage] = useState<string | null>(null);

  const [cloneLoading, setCloneLoading] = useState(true);
  const [cloneError, setCloneError] = useState<string | null>(null);

  // 历史帖子编辑状态
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState('');
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [expandedIdeal, setExpandedIdeal] = useState(false);

  const hasApi = Boolean(getApiBaseUrl());
  const navigate = useNavigate();

  // 默认头像按性别
  const defaultAvatar = gender === 'female' ? FEMALE_AVATAR : MALE_AVATAR;
  const avatarSrc = useAvatar(defaultAvatar);

  const applyClone = useCallback(
    (c: CloneMe, opts?: { keepPosts?: boolean }) => {
      setIsActive(c.status === 'active');
      setPersona(cleanPersonaText(c.persona));
      setBoundaries(c.boundaries ?? EMPTY_BOUNDARIES);
      setGender(c.gender);
      setRelationshipIntent(c.relationshipIntent);
      setScenarioCards(c.scenarioCards);
      setPersonaSketchSections(c.personaSketchSections);
      setIdealPartnerNarrative(c.idealPartnerNarrative);
      setIdealPartnerCardsAnswered(c.idealPartnerCardsAnswered);
      setSocialStats(c.socialStats);
      // pause/resume/update 不重置 posts（这些接口返回 posts=[]）
      if (!opts?.keepPosts) {
        setPosts(c.posts);
      }
    },
    [],
  );

  const refreshPosts = useCallback(async () => {
    if (!hasApi) return;
    try {
      const list = await getMyPosts();
      setPosts(list);
    } catch (err) {
      console.warn('[CloneView] refresh posts failed:', err);
    }
  }, [hasApi]);

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
  }, [hasApi, applyClone]);

  useEffect(() => {
    void fetchClone();
  }, [fetchClone]);

  // ---------- 编辑社交边界 ----------
  const startEditBoundaries = () => {
    setDraftForbidden(forbiddenWordsToText(boundaries.forbiddenWords));
    setDraftTopics(boundaries.topicsToAvoid ?? '');
    setError(null);
    setEditingBoundaries(true);
  };

  const cancelEditBoundaries = () => {
    setDraftForbidden(forbiddenWordsToText(boundaries.forbiddenWords));
    setDraftTopics(boundaries.topicsToAvoid ?? '');
    setError(null);
    setEditingBoundaries(false);
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
    applyClone(updated, { keepPosts: true });
    setEditingBoundaries(false);
  };

  const toggle = async () => {
    if (!hasApi) {
      setIsActive(!isActive);
      return;
    }
    const next = isActive ? await pauseClone() : await resumeClone();
    if (next) applyClone(next, { keepPosts: true });
  };

  // ---------- 发帖 ----------
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

    const displayContent = postHint.trim() || '……';
    setPostHint('');
    setPostMessage(COPY.celebrate.postQueued);

    enqueuePostDraft(postHint).then((result) => {
      if (!result.ok) {
        console.warn('[CloneView] post enqueue failed:', result);
      }
    });

    await onPostQueued?.(displayContent);
    // 发帖入队后刷新历史帖子列表（Worker 生成后可见）
    void refreshPosts();
  };

  // ---------- 历史帖子编辑 ----------
  const startEditPost = (postId: string, content: string) => {
    setEditingPostId(postId);
    setEditingPostContent(content);
  };

  const cancelEditPost = () => {
    setEditingPostId(null);
    setEditingPostContent('');
    setEditError(null);
  };

  const savePost = async (postId: string) => {
    const content = editingPostContent.trim();
    if (!content) {
      setEditError('帖子内容不能为空');
      return;
    }
    setEditError(null);
    setSavingPostId(postId);
    try {
      const updated = await updatePost(postId, content);
      if (updated) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
      } else {
        setEditError('编辑失败，请稍后重试');
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '编辑失败');
    } finally {
      setSavingPostId(null);
      setEditingPostId(null);
      setEditingPostContent('');
    }
  };

  const togglePostExpand = (postId: string) => {
    setExpandedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const handleDeletePost = async (postId: string) => {
    setDeletePostId(postId);
    try {
      const ok = await deletePost(postId);
      if (ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } else {
        setEditError('删除失败，请稍后重试');
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeletePostId(null);
    }
  };

  const idealPreview = useMemo(() => {
    if (!idealPartnerNarrative) return '';
    return idealPartnerNarrative.length > 150
      ? idealPartnerNarrative.slice(0, 150) + '…'
      : idealPartnerNarrative;
  }, [idealPartnerNarrative]);

  return (
    <div className="pb-24 px-6">
      <Header title="我的分身" rightSlot={headerRight} />

      {/* 加载中 */}
      {cloneLoading && (
        <div className="mt-16 flex flex-col items-center">
          <LottieLoader size={288} />
          <p className="text-base font-bold tracking-wide mt-1" style={{ color: '#121c28' }}>{COPY.loading.cloneInfo}</p>
        </div>
      )}

      {/* 加载失败 */}
      {!cloneLoading && cloneError && (
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="text-sm mb-4" style={{ color: '#ba1a1a' }}>{cloneError}</p>
          <button
            type="button"
            onClick={fetchClone}
            className="px-4 py-2 rounded-xl text-sm"
            style={{ backgroundColor: 'rgba(43,138,239,0.12)', color: '#2B8AEF' }}
          >
            {COPY.btn.tryAgain}
          </button>
        </div>
      )}

      {/* 正常显示 */}
      {!cloneLoading && !cloneError && (
      <div className="mt-8 flex flex-col items-center">
        <div
          className={`w-32 h-32 rounded-full border-4 flex items-center justify-center p-1 relative`}
          style={{
            borderColor: isActive ? '#2B8AEF' : '#7b7487',
            boxShadow: isActive ? '0 0 20px rgba(43,138,239,0.15)' : undefined,
          }}
        >
          <img
            src={avatarSrc}
            alt="My Clone"
            className={`w-full h-full rounded-full transition-opacity ${isActive ? 'opacity-100' : 'opacity-40 grayscale'}`}
          />
          <div
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: isActive ? '#2B8AEF' : '#7b7487',
              color: isActive ? '#121c28' : '#ffffff',
            }}
          >
            {isActive ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
          </div>
        </div>

        <div className="mt-4 text-center w-full max-w-[375px]">
          <h2 className="text-2xl font-bold" style={{ color: '#121c28' }}>我的分身</h2>
          {/* 状态文字：relationshipIntent | 运行中/休眠中（删除"正在学习与社交"硬编码） */}
          <p className="text-sm font-medium" style={{ color: '#2B8AEF' }}>
            状态：{intentLabel(relationshipIntent)} | {isActive ? '运行中' : '休眠中'}
          </p>
        </div>

        {/* 人格设定卡片区（替代原 2x2 grid） */}
        <div className="mt-6 w-full grid grid-cols-2 gap-3">
          {/* 第一行：人格线索（画像叙事，基于入驻前 15 题总结的人物画像） */}
          <div className="p-4 rounded-2xl border col-span-2 text-left" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
            <p className="text-xs mb-2 font-bold tracking-wide" style={{ color: '#7b7487' }}>人格线索</p>
            {personaSketchSections && personaSketchSections.length > 0 ? (
              <div className="space-y-2">
                {personaSketchSections.map((sec) => (
                  <div key={sec.key} className="rounded-xl px-3 py-2" style={{ backgroundColor: '#f8f9ff' }}>
                    <p className="text-[11px] font-bold mb-0.5" style={{ color: '#2B8AEF' }}>{sec.title}</p>
                    <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#121c28' }}>{sec.narrative}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: '#7b7487' }}>暂无人格线索，完成入驻问卷后将生成。</p>
            )}
          </div>

          {/* 第二行：累计社交（三行分项统计） */}
          <div className="p-4 rounded-2xl border col-span-2" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
            <p className="text-xs mb-2 font-bold tracking-wide" style={{ color: '#7b7487' }}>累计社交</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-bold" style={{ color: '#121c28' }}>{socialStats.postCount}</p>
                <p className="text-[10px]" style={{ color: '#7b7487' }}>发帖</p>
              </div>
              <div className="border-x" style={{ borderColor: '#d9e3f4' }}>
                <p className="text-xl font-bold" style={{ color: '#121c28' }}>{socialStats.commentCount}</p>
                <p className="text-[10px]" style={{ color: '#7b7487' }}>回复评论</p>
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: '#121c28' }}>{socialStats.matchCount}</p>
                <p className="text-[10px]" style={{ color: '#7b7487' }}>匹配</p>
              </div>
            </div>
          </div>

          {/* 第三行：理想型描述（有则展示，无则 CTA 补做） */}
          <div className="p-4 rounded-2xl border col-span-2 text-left" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
            <p className="text-xs mb-2 font-bold tracking-wide" style={{ color: '#7b7487' }}>理想型</p>
            {idealPartnerNarrative ? (
              <>
                <p className="text-xs leading-relaxed" style={{ color: '#121c28' }}>
                  {expandedIdeal ? idealPartnerNarrative : idealPreview}
                </p>
                {idealPartnerNarrative.length > 150 && (
                  <button
                    type="button"
                    onClick={() => setExpandedIdeal((v) => !v)}
                    className="text-[11px] mt-1 font-medium"
                    style={{ color: '#2B8AEF' }}
                  >
                    {expandedIdeal ? '收起' : '查看完整描述'}
                  </button>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs" style={{ color: '#7b7487' }}>
                  {idealPartnerCardsAnswered
                    ? '已答完理想型问卷，点击生成你的理想伴侣画像。'
                    : '还没填写理想型问卷，补做 3 道题即可生成你的理想伴侣画像。'}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/ideal-setup', { state: { skipCards: idealPartnerCardsAnswered } })}
                  className="w-full py-2.5 rounded-xl font-bold text-xs"
                  style={{ backgroundColor: 'rgba(43,138,239,0.12)', color: '#2B8AEF' }}
                >
                  {idealPartnerCardsAnswered ? '生成理想型描述' : '补做理想型问卷'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 编辑社交边界 */}
        {editingBoundaries && (
          <div className="mt-6 w-full text-left space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7b7487' }}>编辑社交边界</p>
            <div>
              <p className="text-xs mb-1" style={{ color: '#7b7487' }}>禁忌词（每行一词，或用逗号分隔）</p>
              <textarea
                value={draftForbidden}
                onChange={(e) => setDraftForbidden(e.target.value)}
                placeholder={'例如：政治\n借钱\n脏话'}
                rows={4}
                disabled={saving}
                className="w-full rounded-xl px-3 py-2 text-sm disabled:opacity-60"
                style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4', borderWidth: 1, color: '#121c28' }}
              />
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: '#7b7487' }}>回避话题（可选）</p>
              <textarea
                value={draftTopics}
                onChange={(e) => setDraftTopics(e.target.value)}
                placeholder="例如：不谈前任、不索要联系方式"
                rows={2}
                disabled={saving}
                className="w-full rounded-xl px-3 py-2 text-sm disabled:opacity-60"
                style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4', borderWidth: 1, color: '#121c28' }}
              />
            </div>
            {error && <p className="text-sm" style={{ color: '#ba1a1a' }}>{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelEditBoundaries}
                disabled={saving}
                className="flex-1 py-3 rounded-2xl font-bold text-sm border disabled:opacity-50"
                style={{ backgroundColor: '#E8F4FF', borderColor: '#d9e3f4', color: '#7b7487' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void saveBoundaries()}
                disabled={saving}
                className="flex-1 py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                style={{ backgroundColor: '#2B8AEF', color: '#ffffff' }}
              >
                {saving ? COPY.submitting.save : COPY.btn.save}
              </button>
            </div>
          </div>
        )}

        {/* 自动发帖 + 历史帖子 + 操作按钮 */}
        <div className="mt-6 w-full space-y-3">
          {!editingBoundaries && (
            <>
              {/* 自动发帖说明区 */}
              <div className="p-4 rounded-2xl border text-left space-y-3" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
                <p className="text-xs leading-relaxed" style={{ color: '#7b7487' }}>{AUTO_POST_HINT}</p>
                <div>
                  <p className="text-xs mb-1" style={{ color: '#7b7487' }}>发帖提示（可选）</p>
                  <textarea
                    value={postHint}
                    onChange={(e) => setPostHint(e.target.value)}
                    placeholder="留空则由分身根据人格自动生成…"
                    rows={2}
                    disabled={!isActive}
                    className="w-full rounded-xl px-3 py-2 text-sm disabled:opacity-50"
                    style={{ backgroundColor: '#f8f9ff', borderColor: '#d9e3f4', borderWidth: 1, color: '#121c28' }}
                  />
                </div>
                {postMessage && <p className="text-xs" style={{ color: '#2B8AEF' }}>{postMessage}</p>}
                {error && <p className="text-xs" style={{ color: '#ba1a1a' }}>{error}</p>}
                <button
                  type="button"
                  onClick={() => void submitPost()}
                  disabled={!hasApi ? false : !isActive}
                  className="w-full py-3 rounded-2xl font-bold text-sm disabled:opacity-50"
                  style={{ backgroundColor: '#2B8AEF', color: '#ffffff' }}
                >
                  {COPY.btn.postAsClone}
                </button>
                {!isActive && hasApi && (
                  <p className="text-[10px]" style={{ color: 'rgba(180,130,0,0.9)' }}>{COPY.error.cloneSleeping}</p>
                )}
              </div>

              {/* 历史帖子列表 */}
              <div className="p-4 rounded-2xl border text-left space-y-3" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold tracking-wide" style={{ color: '#7b7487' }}>我的发帖</p>
                  <button
                    type="button"
                    onClick={() => void refreshPosts()}
                    className="text-[11px]"
                    style={{ color: '#2B8AEF' }}
                  >
                    刷新
                  </button>
                </div>
                {posts.length === 0 ? (
                  <p className="text-xs" style={{ color: '#7b7487' }}>还没有发帖记录。</p>
                ) : (
                  <div className="space-y-3">
                    {posts.map((post) => {
                      const expanded = expandedPostIds.has(post.id);
                      const isEditingThis = editingPostId === post.id;
                      return (
                        <div key={post.id} className="rounded-xl px-3 py-2" style={{ backgroundColor: '#f8f9ff' }}>
                          {isEditingThis ? (
                            <div className="space-y-2">
                              <textarea
                                value={editingPostContent}
                                onChange={(e) => setEditingPostContent(e.target.value)}
                                rows={4}
                                disabled={savingPostId === post.id}
                                className="w-full rounded-lg px-2 py-1.5 text-xs disabled:opacity-60"
                                style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4', borderWidth: 1, color: '#121c28' }}
                              />
                              {editError && (
                                <p className="text-[11px]" style={{ color: '#ba1a1a' }}>{editError}</p>
                              )}
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={cancelEditPost}
                                  disabled={savingPostId === post.id}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-bold border disabled:opacity-50"
                                  style={{ backgroundColor: '#E8F4FF', borderColor: '#d9e3f4', color: '#7b7487' }}
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void savePost(post.id)}
                                  disabled={savingPostId === post.id}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                                  style={{ backgroundColor: '#2B8AEF', color: '#ffffff' }}
                                >
                                  {savingPostId === post.id ? '保存中…' : '保存'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p
                                className={`text-xs leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}
                                style={{ color: '#121c28' }}
                              >
                                {post.content}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px]" style={{ color: '#7b7487' }}>{relativeTime(post.createdAt)}</span>
                                {post.isAutoGenerated && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(43,138,239,0.12)', color: '#2B8AEF' }}>
                                    自动生成
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => togglePostExpand(post.id)}
                                  className="text-[10px] ml-auto"
                                  style={{ color: '#2B8AEF' }}
                                >
                                  {expanded ? '收起' : '展开'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditPost(post.id, post.content)}
                                  className="text-[10px]"
                                  style={{ color: '#2B8AEF' }}
                                >
                                  编辑
                                </button>
                                <button
                                  type="button"
                                  disabled={deletePostId === post.id}
                                  onClick={() => {
                                    if (window.confirm('确定删除这条帖子吗？')) {
                                      void handleDeletePost(post.id);
                                    }
                                  }}
                                  className="text-[10px] disabled:opacity-50"
                                  style={{ color: '#ba1a1a' }}
                                >
                                  {deletePostId === post.id ? '删除中…' : '删除'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={startEditBoundaries}
                className="w-full py-4 rounded-2xl font-bold text-sm border"
                style={{ backgroundColor: '#E8F4FF', borderColor: '#d9e3f4', color: '#121c28' }}
              >
                {COPY.btn.editBoundaries}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => void toggle()}
            disabled={editingBoundaries}
            className="w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            style={
              isActive
                ? { backgroundColor: '#ffffff', color: '#ba1a1a', border: '1px solid rgba(186,26,26,0.3)' }
                : { backgroundColor: '#2B8AEF', color: '#ffffff' }
            }
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
