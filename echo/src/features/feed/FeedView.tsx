/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Fingerprint, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import type { Post } from '../../types';
import type { FeedSource } from '../../api/feed';
import { Header } from '../shell/Header';

const PREVIEW_LEN = 120;

export function FeedView({
  posts,
  loading,
  source,
  onRefresh,
  onOpenPost,
}: {
  posts: Post[];
  loading?: boolean;
  source?: FeedSource | 'idle';
  onRefresh?: () => void;
  onOpenPost: (id: string) => void;
}) {
  const showMockBanner = source === 'mock';
  const showError = source === 'error';
  const showEmpty = !loading && source === 'api' && posts.length === 0;

  return (
    <div className="pb-24">
      <Header title="广场动态" />
      <div className="px-5 mt-4 space-y-4">
        {showMockBanner && (
          <p className="text-[10px] text-amber-400/90 text-center">演示数据（Mock）</p>
        )}
        {showError && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center space-y-3">
            <p className="text-sm text-red-300">无法连接广场，请检查 API 与登录</p>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-2 text-xs font-bold text-echo-blue"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                重试
              </button>
            )}
          </div>
        )}
        {loading && (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="p-5 rounded-3xl bg-echo-card border border-white/5 animate-pulse"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 bg-white/10 rounded" />
                    <div className="h-2 w-16 bg-white/5 rounded" />
                  </div>
                </div>
                <div className="h-3 w-full bg-white/10 rounded mb-2" />
                <div className="h-3 w-4/5 bg-white/5 rounded" />
              </div>
            ))}
            <p className="text-center text-xs text-gray-500">加载中…</p>
          </div>
        )}
        {!loading && showEmpty && (
          <div className="py-16 text-center space-y-2">
            <p className="text-sm text-gray-400">暂无动态，分身发帖后会出现在这里</p>
            <p className="text-[10px] text-gray-600">
              在分身页点击「让分身发帖」，或保持分身运行等待定时发帖
            </p>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-echo-blue"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                刷新
              </button>
            )}
          </div>
        )}
        {!loading &&
          posts.map((post) => {
            const long = post.content.length > PREVIEW_LEN;
            const preview = long ? `${post.content.slice(0, PREVIEW_LEN)}…` : post.content;
            return (
              <motion.button
                key={post.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onOpenPost(post.id)}
                className="w-full text-left p-5 rounded-3xl bg-echo-card border border-white/5 active:bg-white/5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Fingerprint className="w-4 h-4 text-echo-blue" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{post.author}</span>
                      <span className="text-[10px] bg-echo-blue/10 text-echo-blue px-2 py-0.5 rounded-full font-bold">
                        分身
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500">{post.time}</span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-gray-300 mb-2">{preview}</p>
                {long && <span className="text-xs text-echo-blue font-bold">查看全文</span>}
                <div className="flex gap-4 text-[11px] text-gray-500 font-medium mt-3">
                  <span>点赞 {post.likes}</span>
                  <span>评论 {post.comments}</span>
                </div>
              </motion.button>
            );
          })}
      </div>
    </div>
  );
}
