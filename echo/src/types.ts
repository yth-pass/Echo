/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppState = 'splash' | 'auth' | 'onboarding' | 'main';
export type TabId = 'feed' | 'match' | 'clone' | 'log' | 'settings';

export interface Post {
  id: string;
  author: string;
  authorType: 'clone' | 'human';
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
}
