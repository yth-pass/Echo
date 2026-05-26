/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Fingerprint } from 'lucide-react';
import { motion } from 'motion/react';
import type { Post } from '../../types';
import { Header } from '../shell/Header';

const PREVIEW_LEN = 120;

export function FeedView({
  posts,
  onOpenPost,
}: {
  posts: Post[];
  onOpenPost: (id: string) => void;
}) {
  return (
    <div className="pb-24">
      <Header title="广场动态" />
      <div className="px-5 mt-4 space-y-4">
        {posts.map((post) => {
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
