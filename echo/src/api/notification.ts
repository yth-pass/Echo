/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { apiDeleteJson, apiGetJson, apiPostJson, unwrap } from './client';

/** 评论回复通知的结构化上下文（对应后端 Notification.metadataJson）。 */
export interface NotificationQuotedComment {
  content: string;
  authorName?: string;
}

export interface NotificationMetadata {
  /** 发起动作的用户名（评论者）。 */
  actorName?: string;
  /** 新评论内容（已截断）。 */
  replyContent?: string;
  /** 被回复的原评论引用（B 站风格灰色引用块）。 */
  quotedComment?: NotificationQuotedComment;
  /** 关联帖子 id，用于点击跳转。 */
  postId?: string;
  /** 新评论 id。 */
  commentId?: string;
  /** 被回复的评论 id。 */
  parentCommentId?: string;
}

export interface NotificationItem {
  id: string;
  type: 'match_request' | 'match_accepted' | 'comment' | 'reply' | 'comment_reply';
  title: string;
  body: string;
  read: boolean;
  ref_type: string | null;
  ref_id: string | null;
  from_user_id: string | null;
  created_at: string;
  metadata?: NotificationMetadata | null;
}

export async function loadNotifications(): Promise<NotificationItem[]> {
  const raw = unwrap(await apiGetJson<{ items: NotificationItem[] }>('/notifications'));
  return raw?.items ?? [];
}

export async function loadUnreadCount(): Promise<number> {
  const raw = unwrap(await apiGetJson<{ count: number }>('/notifications/unread-count'));
  return raw?.count ?? 0;
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const r = await apiPostJson(`/notifications/${id}/read`, {});
  return r.ok;
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const r = await apiPostJson('/notifications/read-all', {});
  return r.ok;
}

export async function deleteNotification(id: string): Promise<boolean> {
  const r = await apiDeleteJson(`/notifications/${id}`);
  return r.ok;
}

// --- Match request APIs ---

export async function sendMatchRequest(targetUserId: string): Promise<{ ok: boolean; message?: string }> {
  const r = await apiPostJson('/matches/request', { targetUserId });
  if (r.ok) return { ok: true };
  return { ok: false, message: 'message' in r ? r.message : '发送匹配请求失败' };
}

export async function acceptMatchRequest(matchPushId: string): Promise<{ ok: boolean; message?: string }> {
  const r = await apiPostJson(`/matches/${matchPushId}/accept`, {});
  if (r.ok) return { ok: true };
  return { ok: false, message: 'message' in r ? r.message : '接受匹配请求失败' };
}

// --- User public profile API ---

/** mapPostDto 返回的帖子预览（轻量，无 authorType/time 格式化）。 */
export interface PostPreview {
  id: string;
  content: string;
  author: string;
  author_display: string;
  author_avatar: string | null;
  author_user_id: string;
  created_at: string;
  likes: number;
  comments: number;
}

export interface PersonaSketchSection {
  key: string;
  title: string;
  narrative: string;
}

export interface PersonaSketch {
  narrative: string;
  sections: PersonaSketchSection[];
}

export interface IdealPartnerSketch {
  narrative: string;
  /** 4 维 ideal 雷达图数据：emotionalSafety / spaceRespect / directCommunication / conflictResolution，值域 -1 ~ +1。 */
  dimensions: Record<string, number>;
}

export interface PublicProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
  gender: string | null;
  interests: string[];
  goalOnEcho: string | null;
  postCount: number;
  /** 该用户最近 5 篇帖子预览（已审核通过）。 */
  posts: PostPreview[];
  /** 人格画像（入驻后生成），未入驻时为 null。 */
  personaSketch: PersonaSketch | null;
  /** 理想型画像（入驻后生成），未入驻时为 null。 */
  idealPartnerSketch: IdealPartnerSketch | null;
}

export async function loadPublicProfile(userId: string): Promise<PublicProfile | null> {
  return unwrap(await apiGetJson<PublicProfile>(`/users/${userId}/profile`));
}
