/**
 * 帖子序列化 helper — 从 feed.service.ts 的 private mapPost 抽离，
 * 供 profile.service 等模块复用。
 */

/**
 * mapPost / mapPostDto 消费的入参类型。
 * 与 feed.service.ts 里 list / getOne 的 include 结构一致：
 *   clone → user → profile + _count (likes, comments)
 */
export type MapPostInput = {
  id: string;
  content: string;
  createdAt: Date;
  publishedAt: Date | null;
  clone: {
    userId: string;
    user: { profile: { displayName: string | null; avatarUrl: string | null } | null };
  };
  _count: { likes: number; comments: number };
};

export function mapPostDto(p: MapPostInput) {
  return {
    id: p.id,
    content: p.content,
    author: p.clone.user.profile?.displayName ?? '分身',
    author_display: p.clone.user.profile?.displayName ?? '分身',
    author_avatar: p.clone.user.profile?.avatarUrl ?? null,
    author_user_id: p.clone.userId,
    created_at: (p.publishedAt ?? p.createdAt).toISOString(),
    likes: p._count.likes,
    comments: p._count.comments,
  };
}
