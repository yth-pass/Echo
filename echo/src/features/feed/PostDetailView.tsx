/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Fingerprint, Heart } from 'lucide-react';
import { loadPostDetail, createComment, toggleCommentLike, type PostDetail, type CommentItem } from '../../api/feed';
import type { ReportTargetType } from '../../api/report';
import { ReportSheet } from '../report/ReportSheet';
import type { Post } from '../../types';
import { COPY } from '../../copy';

type ReportPrefill = {
  targetType: ReportTargetType;
  targetId: string;
};

export function PostDetailView({
  postId,
  initialPost,
  onBack,
  onOpenProfile,
}: {
  postId: string;
  initialPost?: Post;
  onBack: () => void;
  onOpenProfile?: (userId: string) => void;
}) {
  const [post, setPost] = useState<PostDetail | null>(
    initialPost ? { ...initialPost, comments_list: [] } : null,
  );
  const [loading, setLoading] = useState(!initialPost);
  const [reportPrefill, setReportPrefill] = useState<ReportPrefill | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  // 递归更新评论树中指定评论的点赞状态（乐观更新用）
  const applyCommentLike = (commentId: string, liked: boolean, likes: number) => {
    setPost((prev) => {
      if (!prev?.comments_list) return prev;
      const updateList = (list: CommentItem[]): CommentItem[] =>
        list.map((c) => {
          if (c.id === commentId) return { ...c, liked, likes };
          if (c.replies?.length) return { ...c, replies: updateList(c.replies) };
          return c;
        });
      return { ...prev, comments_list: updateList(prev.comments_list) };
    });
  };

  // 切换评论点赞：乐观更新 → 调接口 → 用后端结果校正或回滚
  const handleToggleLike = async (commentId: string, liked: boolean, likes: number) => {
    const optimisticLiked = !liked;
    const optimisticLikes = liked ? Math.max(0, likes - 1) : likes + 1;
    applyCommentLike(commentId, optimisticLiked, optimisticLikes);
    const res = await toggleCommentLike(commentId, liked);
    if (res) {
      applyCommentLike(commentId, res.liked, res.likes);
    } else {
      applyCommentLike(commentId, liked, likes); // 回滚
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!initialPost) setLoading(true);
    void loadPostDetail(postId).then((p) => {
      if (!cancelled) {
        setPost(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [postId, initialPost]);

  const handleSendComment = async () => {
    const text = commentText.trim();
    if (!text || submitting || !post) return;
    setSubmitting(true);
    setCommentError(null);
    const res = await createComment(postId, text);
    if (res.ok && res.comment) {
      setPost({
        ...post,
        comments: post.comments + 1,
        comments_list: [...(post.comments_list ?? []), res.comment],
      });
      setCommentText('');
    } else {
      setCommentError(res.message ?? '评论发送失败，请稍后再试');
    }
    setSubmitting(false);
  };

  const handleSendReply = async (parentCommentId: string) => {
    const text = replyText.trim();
    if (!text || replySubmitting || !post) return;
    setReplySubmitting(true);
    setReplyError(null);
    const res = await createComment(postId, text, parentCommentId);
    if (res.ok && res.comment) {
      const appendReplyToTree = (comments: CommentItem[], parentId: string, reply: CommentItem): CommentItem[] => {
        return comments.map((c) => {
          if (c.id === parentId) {
            return { ...c, replies: [...(c.replies ?? []), reply] };
          }
          if (c.replies?.length) {
            return { ...c, replies: appendReplyToTree(c.replies, parentId, reply) };
          }
          return c;
        });
      };
      setPost({
        ...post,
        comments: post.comments + 1,
        comments_list: appendReplyToTree(post.comments_list ?? [], parentCommentId, res.comment),
      });
      setReplyText('');
      setReplyingTo(null);
    } else {
      setReplyError(res.message ?? '回复发送失败，请稍后再试');
    }
    setReplySubmitting(false);
  };

  function flattenAllReplies(replies: CommentItem[], parentAuthor?: string): Array<CommentItem & { reply_to_author?: string }> {
    const result: Array<CommentItem & { reply_to_author?: string }> = [];
    for (const r of replies) {
      result.push({ ...r, reply_to_author: parentAuthor });
      if (r.replies?.length) {
        result.push(...flattenAllReplies(r.replies, r.author));
      }
    }
    return result;
  }

  const display = post;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 max-w-[375px] mx-auto z-[110] flex flex-col"
      style={{ backgroundColor: '#f8f9ff' }}
    >
      <div className="p-4 flex items-center justify-between border-b" style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: '1px solid #d9e3f4' }}>
        <button type="button" onClick={onBack} className="text-sm" style={{ color: '#7b7487' }}>
          返回
        </button>
        <h2 className="font-bold text-sm" style={{ color: '#121c28' }}>动态详情</h2>
        <button
          type="button"
          onClick={() => setReportPrefill({ targetType: 'post', targetId: postId })}
          className="text-amber-400/90 text-xs font-bold"
        >
          举报
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {loading && !display && <p className="text-sm" style={{ color: '#7b7487' }}>{COPY.loading.postDetail}</p>}
        {!loading && !display && <p className="text-sm" style={{ color: '#ba1a1a' }}>无法加载帖子</p>}
        {display && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={() => { if (display.authorUserId) onOpenProfile?.(display.authorUserId); }}
                className="shrink-0 rounded-full disabled:cursor-default"
                disabled={!display.authorUserId}
              >
                {display.authorAvatarUrl ? (
                  <img
                    src={display.authorAvatarUrl}
                    alt={display.author}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(43,138,239,0.12)' }}>
                    <Fingerprint className="w-5 h-5" style={{ color: '#2B8AEF' }} />
                  </div>
                )}
              </button>
              <div>
                <p className="font-bold" style={{ color: '#121c28' }}>{display.author}</p>
                <p className="text-[10px]" style={{ color: '#7b7487' }}>{display.time}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap mb-6" style={{ color: '#121c28' }}>
              {display.content}
            </p>
            <p className="text-xs mb-4" style={{ color: '#7b7487' }}>
              点赞 {display.likes} · 评论 {display.comments}
            </p>
            <h3 className="text-xs font-bold uppercase mb-3" style={{ color: '#7b7487' }}>评论</h3>
            {loading && !display.comments_list?.length && (
              <p className="text-xs" style={{ color: '#7b7487' }}>{COPY.loading.comments}</p>
            )}
            {display.comments_list?.length ? (
              <div className="space-y-4">
                {display.comments_list.map((comment) => {
                  const allReplies = flattenAllReplies(comment.replies ?? []);
                  const isExpanded = expandedReplies.has(comment.id);
                  const visibleReplies = isExpanded ? allReplies : allReplies.slice(0, 2);

                  return (
                    <div key={comment.id}>
                      {/* 顶层评论卡片 */}
                      <div className="flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => { if (comment.author_user_id) onOpenProfile?.(comment.author_user_id); }}
                          className="shrink-0 rounded-full disabled:cursor-default"
                          disabled={!comment.author_user_id}
                        >
                          {comment.author_avatar ? (
                            <img src={comment.author_avatar} alt={comment.author} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(43,138,239,0.12)' }}>
                              <Fingerprint className="w-4 h-4" style={{ color: '#2B8AEF' }} />
                            </div>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] mb-1" style={{ color: '#2B8AEF' }}>{comment.author}</p>
                          <p className="text-sm leading-relaxed" style={{ color: '#121c28' }}>{comment.content}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px]" style={{ color: '#7b7487' }}>{comment.created_at}</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (replyingTo === comment.id) {
                                  setReplyingTo(null);
                                  setReplyText('');
                                  setReplyError(null);
                                } else {
                                  setReplyingTo(comment.id);
                                  setReplyText('');
                                  setReplyError(null);
                                }
                              }}
                              className="text-[11px] font-bold"
                              style={{ color: replyingTo === comment.id ? '#7b7487' : '#2B8AEF' }}
                            >
                              {replyingTo === comment.id ? '取消' : '回复'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleLike(comment.id, comment.liked, comment.likes)}
                              className="flex items-center gap-1 text-[11px] font-bold"
                              style={{ color: comment.liked ? '#2B8AEF' : '#7b7487' }}
                            >
                              <Heart className={`w-3 h-3 ${comment.liked ? 'fill-current' : ''}`} />
                              {comment.likes}
                            </button>
                            <button
                              type="button"
                              onClick={() => setReportPrefill({ targetType: 'comment', targetId: comment.id })}
                              className="text-[10px] text-amber-400/80 font-bold"
                            >
                              举报
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 子评论区域（平铺，无缩进） */}
                      {allReplies.length > 0 && (
                        <div className="mt-3 pl-[42px]">
                          {visibleReplies.map((r) => (
                            <div key={r.id} className="flex gap-2 mb-3">
                              <button
                                type="button"
                                onClick={() => { if (r.author_user_id) onOpenProfile?.(r.author_user_id); }}
                                className="shrink-0 rounded-full disabled:cursor-default"
                                disabled={!r.author_user_id}
                              >
                                {r.author_avatar ? (
                                  <img src={r.author_avatar} alt={r.author} className="w-6 h-6 rounded-full object-cover mt-0.5" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: 'rgba(43,138,239,0.08)' }}>
                                    <Fingerprint className="w-3 h-3" style={{ color: '#2B8AEF' }} />
                                  </div>
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[11px]" style={{ color: '#2B8AEF' }}>{r.author}</p>
                                  {r.reply_to_author && (
                                    <span className="text-[10px]" style={{ color: '#7b7487' }}>回复 @{r.reply_to_author}</span>
                                  )}
                                </div>
                                <p className="text-[13px] leading-relaxed mt-0.5" style={{ color: '#121c28' }}>{r.content}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[10px]" style={{ color: '#7b7487' }}>{r.created_at}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingTo(r.id === replyingTo ? null : r.id);
                                      setReplyText('');
                                      setReplyError(null);
                                    }}
                                    className="text-[10px] font-bold"
                                    style={{ color: replyingTo === r.id ? '#7b7487' : '#2B8AEF' }}
                                  >
                                    {replyingTo === r.id ? '取消' : '回复'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleToggleLike(r.id, r.liked, r.likes)}
                                    className="flex items-center gap-1 text-[10px] font-bold"
                                    style={{ color: r.liked ? '#2B8AEF' : '#7b7487' }}
                                  >
                                    <Heart className={`w-3 h-3 ${r.liked ? 'fill-current' : ''}`} />
                                    {r.likes}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setReportPrefill({ targetType: 'comment', targetId: r.id })}
                                    className="text-[10px] text-amber-400/80 font-bold"
                                  >
                                    举报
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* 展开/收起 */}
                          {allReplies.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setExpandedReplies((prev) => {
                                const next = new Set(prev);
                                if (next.has(comment.id)) next.delete(comment.id);
                                else next.add(comment.id);
                                return next;
                              })}
                              className="text-[12px] font-bold mb-2"
                              style={{ color: '#2B8AEF' }}
                            >
                              {isExpanded ? '收起回复' : `共${allReplies.length}条回复 ▶`}
                            </button>
                          )}

                          {/* 回复输入框 */}
                          {replyingTo && (comment.id === replyingTo || allReplies.some((r) => r.id === replyingTo)) && (
                            <div className="mt-1 mb-2">
                              {replyError && (
                                <p className="text-[11px] mb-1.5" style={{ color: '#ba1a1a' }}>{replyError}</p>
                              )}
                              <div className="flex items-end gap-2">
                                <textarea
                                  value={replyText}
                                  onChange={(e) => {
                                    setReplyText(e.target.value);
                                    if (replyError) setReplyError(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      void handleSendReply(comment.id);
                                    }
                                  }}
                                  placeholder={`回复 ${replyingTo === comment.id ? comment.author : allReplies.find((r) => r.id === replyingTo)?.author ?? ''}…`}
                                  rows={1}
                                  className="flex-1 resize-none rounded-2xl px-3 py-2 text-sm outline-none border"
                                  style={{ backgroundColor: '#f8f9ff', borderColor: '#d9e3f4', color: '#121c28', maxHeight: 80 }}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSendReply(comment.id)}
                                  disabled={!replyText.trim() || replySubmitting}
                                  className="shrink-0 rounded-2xl px-3 py-2 text-xs font-bold transition-opacity disabled:opacity-60"
                                  style={{
                                    backgroundColor: replyText.trim() && !replySubmitting ? '#2B8AEF' : '#d9e3f4',
                                    color: replyText.trim() && !replySubmitting ? '#ffffff' : '#7b7487',
                                  }}
                                >
                                  {replySubmitting ? '发送中' : '回复'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 无子评论时，顶层评论的回复输入框 */}
                      {allReplies.length === 0 && replyingTo === comment.id && (
                        <div className="mt-2 pl-[42px]">
                          {replyError && (
                            <p className="text-[11px] mb-1.5" style={{ color: '#ba1a1a' }}>{replyError}</p>
                          )}
                          <div className="flex items-end gap-2">
                            <textarea
                              value={replyText}
                              onChange={(e) => {
                                setReplyText(e.target.value);
                                if (replyError) setReplyError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  void handleSendReply(comment.id);
                                }
                              }}
                              placeholder={`回复 ${comment.author}…`}
                              rows={1}
                              className="flex-1 resize-none rounded-2xl px-3 py-2 text-sm outline-none border"
                              style={{ backgroundColor: '#f8f9ff', borderColor: '#d9e3f4', color: '#121c28', maxHeight: 80 }}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSendReply(comment.id)}
                              disabled={!replyText.trim() || replySubmitting}
                              className="shrink-0 rounded-2xl px-3 py-2 text-xs font-bold transition-opacity disabled:opacity-60"
                              style={{
                                backgroundColor: replyText.trim() && !replySubmitting ? '#2B8AEF' : '#d9e3f4',
                                color: replyText.trim() && !replySubmitting ? '#ffffff' : '#7b7487',
                              }}
                            >
                              {replySubmitting ? '发送中' : '回复'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              !loading && <p className="text-xs" style={{ color: '#7b7487' }}>{COPY.empty.comments}</p>
            )}
          </>
        )}
      </div>

      {display && (
        <div
          className="border-t p-3"
          style={{
            backgroundColor: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(12px)',
            borderColor: '#d9e3f4',
          }}
        >
          {commentError && (
            <p className="text-[11px] mb-1.5" style={{ color: '#ba1a1a' }}>
              {commentError}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={commentText}
              onChange={(e) => {
                setCommentText(e.target.value);
                if (commentError) setCommentError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendComment();
                }
              }}
              placeholder="说点什么…"
              rows={1}
              className="flex-1 resize-none rounded-2xl px-3 py-2 text-sm outline-none border"
              style={{
                backgroundColor: '#f8f9ff',
                borderColor: '#d9e3f4',
                color: '#121c28',
                maxHeight: 100,
              }}
            />
            <button
              type="button"
              onClick={handleSendComment}
              disabled={!commentText.trim() || submitting}
              className="shrink-0 rounded-2xl px-4 py-2 text-xs font-bold transition-opacity disabled:opacity-60"
              style={{
                backgroundColor: commentText.trim() && !submitting ? '#2B8AEF' : '#d9e3f4',
                color: commentText.trim() && !submitting ? '#ffffff' : '#7b7487',
              }}
            >
              {submitting ? '发送中' : '发送'}
            </button>
          </div>
        </div>
      )}

      {reportPrefill && (
        <ReportSheet
          initialTargetType={reportPrefill.targetType}
          initialTargetId={reportPrefill.targetId}
          onClose={() => setReportPrefill(null)}
        />
      )}
    </motion.div>
  );
}
