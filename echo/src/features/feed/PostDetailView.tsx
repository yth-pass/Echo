/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Fingerprint } from 'lucide-react';
import { loadPostDetail, type PostDetail } from '../../api/resources';

export function PostDetailView({ postId, onBack }: { postId: string; onBack: () => void }) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadPostDetail(postId).then((p) => {
      if (!cancelled) {
        setPost(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [postId]);

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
        <div className="w-8" />
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {loading && <p className="text-gray-500 text-sm">加载中…</p>}
        {!loading && !post && <p className="text-red-400 text-sm">无法加载帖子</p>}
        {post && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-echo-blue/20 flex items-center justify-center">
                <Fingerprint className="w-5 h-5 text-echo-blue" />
              </div>
              <div>
                <p className="font-bold">{post.author}</p>
                <p className="text-[10px] text-gray-500">{post.time}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap mb-6">
              {post.content}
            </p>
            <p className="text-xs text-gray-500 mb-4">
              点赞 {post.likes} · 评论 {post.comments}
            </p>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">评论</h3>
            {post.comments_list?.length ? (
              <div className="space-y-3">
                {post.comments_list.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl bg-echo-card border border-white/5">
                    <p className="text-[10px] text-echo-blue mb-1">{c.author}</p>
                    <p className="text-sm text-gray-300">{c.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600">暂无评论</p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
