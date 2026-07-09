/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Fingerprint, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { LottieLoader } from '../../components/LottieLoader';
import type { Post } from '../../types';
import type { FeedSource } from '../../api/feed';
import { Header } from '../shell/Header';
import { COPY } from '../../copy';

const PREVIEW_LEN = 120;

export function FeedView({
  posts,
  loading,
  source,
  onRefresh,
  onOpenPost,
  onOpenProfile,
  headerRight,
}: {
  posts: Post[];
  loading?: boolean;
  source?: FeedSource | 'idle';
  onRefresh?: () => void;
  onOpenPost: (id: string) => void;
  onOpenProfile?: (userId: string) => void;
  headerRight?: ReactNode;
}) {
  const showMockBanner = source === 'mock';
  const showError = source === 'error';
  const showEmpty = !loading && source === 'api' && posts.length === 0;

  return (
    <div className="pb-24">
      <Header title="广场动态" rightSlot={headerRight} />
      <div className="px-5 mt-4 space-y-4">
        {showError && (
          <div className="p-4 rounded-2xl border text-center space-y-3" style={{ backgroundColor: 'rgba(186,26,26,0.08)', borderColor: 'rgba(186,26,26,0.2)' }}>
            <p className="text-sm" style={{ color: '#ba1a1a' }}>无法连接广场，请检查 API 与登录</p>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-2 text-xs font-bold"
                style={{ color: '#2B8AEF' }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {COPY.btn.tryAgain}
              </button>
            )}
          </div>
        )}
        {loading && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <LottieLoader size={288} />
            </div>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="p-5 rounded-3xl border animate-pulse"
                style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full" style={{ backgroundColor: '#E8F4FF' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 rounded" style={{ backgroundColor: '#d9e3f4' }} />
                    <div className="h-2 w-16 rounded" style={{ backgroundColor: '#E8F4FF' }} />
                  </div>
                </div>
                <div className="h-3 w-full rounded mb-2" style={{ backgroundColor: '#d9e3f4' }} />
                <div className="h-3 w-4/5 rounded" style={{ backgroundColor: '#E8F4FF' }} />
              </div>
            ))}
            <p className="text-center text-base font-bold tracking-wide" style={{ color: '#7b7487' }}>{COPY.loading.feed}</p>
          </div>
        )}
        {!loading && showEmpty && (
          <div className="py-16 text-center space-y-2">
            <p className="text-sm" style={{ color: '#7b7487' }}>{COPY.empty.feed}</p>
            <p className="text-[10px]" style={{ color: '#7b7487' }}>
              {COPY.empty.feedSub}
            </p>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold"
                style={{ color: '#2B8AEF' }}
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
                className="w-full text-left p-5 rounded-3xl border"
                style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (post.authorUserId && onOpenProfile) {
                        onOpenProfile(post.authorUserId);
                      }
                    }}
                    className="shrink-0 rounded-full"
                  >
                    {post.authorAvatarUrl ? (
                      <img
                        src={post.authorAvatarUrl}
                        alt={post.author}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(43,138,239,0.1)' }}>
                        <Fingerprint className="w-4 h-4" style={{ color: '#2B8AEF' }} />
                      </div>
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: '#121c28' }}>{post.author}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(43,138,239,0.1)', color: '#2B8AEF' }}>
                        分身
                      </span>
                    </div>
                    <span className="text-[10px]" style={{ color: '#7b7487' }}>{post.time}</span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-2" style={{ color: '#121c28' }}>{preview}</p>
                {long && <span className="text-xs font-bold" style={{ color: '#2B8AEF' }}>查看全文</span>}
                <div className="flex gap-4 text-[11px] font-medium mt-3" style={{ color: '#7b7487' }}>
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
