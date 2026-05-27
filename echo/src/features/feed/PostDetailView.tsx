/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Fingerprint } from 'lucide-react';
import { loadPostDetail, type PostDetail } from '../../api/feed';
import type { ReportTargetType } from '../../api/report';
import { ReportSheet } from '../report/ReportSheet';
import type { Post } from '../../types';

type ReportPrefill = {
  targetType: ReportTargetType;
  targetId: string;
};

export function PostDetailView({
  postId,
  initialPost,
  onBack,
}: {
  postId: string;
  initialPost?: Post;
  onBack: () => void;
}) {
  const [post, setPost] = useState<PostDetail | null>(
    initialPost ? { ...initialPost, comments_list: [] } : null,
  );
  const [loading, setLoading] = useState(!initialPost);
  const [reportPrefill, setReportPrefill] = useState<ReportPrefill | null>(null);

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

  const display = post;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 bg-echo-dark z-[110] flex flex-col"
    >
      <div className="p-4 glass flex items-center justify-between border-b border-white/10">
        <button type="button" onClick={onBack} className="text-gray-400 text-sm">
          返回
        </button>
        <h2 className="font-bold text-sm">动态详情</h2>
        <button
          type="button"
          onClick={() => setReportPrefill({ targetType: 'post', targetId: postId })}
          className="text-amber-400/90 text-xs font-bold"
        >
          举报
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {loading && !display && <p className="text-gray-500 text-sm">加载中…</p>}
        {!loading && !display && <p className="text-red-400 text-sm">无法加载帖子</p>}
        {display && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-echo-blue/20 flex items-center justify-center">
                <Fingerprint className="w-5 h-5 text-echo-blue" />
              </div>
              <div>
                <p className="font-bold">{display.author}</p>
                <p className="text-[10px] text-gray-500">{display.time}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap mb-6">
              {display.content}
            </p>
            <p className="text-xs text-gray-500 mb-4">
              点赞 {display.likes} · 评论 {display.comments}
            </p>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">评论</h3>
            {loading && !display.comments_list?.length && (
              <p className="text-xs text-gray-600">评论加载中…</p>
            )}
            {display.comments_list?.length ? (
              <div className="space-y-3">
                {display.comments_list.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl bg-echo-card border border-white/5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] text-echo-blue mb-1">{c.author}</p>
                      <button
                        type="button"
                        onClick={() =>
                          setReportPrefill({ targetType: 'comment', targetId: c.id })
                        }
                        className="text-[10px] text-amber-400/80 font-bold shrink-0"
                      >
                        举报
                      </button>
                    </div>
                    <p className="text-sm text-gray-300">{c.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              !loading && <p className="text-xs text-gray-600">暂无评论</p>
            )}
          </>
        )}
      </div>

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
