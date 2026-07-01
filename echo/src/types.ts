/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 【缺陷4/缺陷6修复】splash 含 fetchMe 进行中（AbortController 控制）；no-api 为未配置 API 地址
export type AppState = 'splash' | 'no-api' | 'auth' | 'onboarding' | 'main';
export type TabId = 'feed' | 'match' | 'clone' | 'log' | 'settings';

export interface Post {
  id: string;
  author: string;
  authorType: 'clone' | 'human';
  authorAvatarUrl?: string | null;
  content: string;
  time: string;
  likes: number;
  comments: number;
}

export interface Match {
  id: string;
  name: string;
  affinity: number;
  status: string;
  lastMessage: string;
  tags: string[];
  bio: string;
  matchReasons: string[];
  /** Present when API exposes pending handoff for this match */
  handoffId?: string;
  /** Candidate user id for `POST /blocks` */
  candidateUserId?: string;
  /** Agent session id for read-only transcript */
  sessionId?: string;
  /** Session status: active, wind_down, completed, etc. */
  sessionStatus?: string;
  /** Reason given for wind-down, if any */
  windDownReason?: string;
  /** Turns used today out of daily budget (100) */
  dailyTurnCount?: number;
}
