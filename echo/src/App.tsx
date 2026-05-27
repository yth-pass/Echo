/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { Home, Fingerprint, History, Settings, Sparkles } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import type { AppState, Match, Post, TabId } from './types';
import { loadFeed, type FeedSource } from './api/feed';
import {
  blockUser,
  dismissMatch,
  loadMatches,
  type MatchSource,
} from './api/match';
import { pollFeedUntilNewPost } from './api/posts';
import { fetchMe, getStoredAccessToken, type AuthSession } from './api/auth';
import { getApiBaseUrl } from './api/client';
import { connectLiveEvents, type LiveWsMessage } from './api/ws';
import { SplashScreen } from './features/splash/SplashScreen';
import { AuthShell } from './features/auth/AuthShell';
import { Onboarding } from './features/onboarding/Onboarding';
import { FeedView } from './features/feed/FeedView';
import { MatchView } from './features/match/MatchView';
import { MatchDetailView } from './features/match/MatchDetailView';
import { CloneView } from './features/clone/CloneView';
import { ActivityLogView } from './features/audit/ActivityLogView';
import { SettingsView } from './features/settings/SettingsView';
import { PostDetailView } from './features/feed/PostDetailView';
import { SessionTranscriptView } from './features/audit/SessionTranscriptView';

export default function App() {
  const [state, setState] = useState<AppState>('splash');
  const [currentTab, setCurrentTab] = useState<TabId>('feed');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedSource, setFeedSource] = useState<FeedSource | 'idle'>('idle');
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchSource, setMatchSource] = useState<MatchSource | 'idle'>('idle');
  const [matchActionError, setMatchActionError] = useState<string | null>(null);

  const refreshFeed = useCallback(async (): Promise<Post[]> => {
    setFeedLoading(true);
    const { posts: nextPosts, source } = await loadFeed();
    setPosts(nextPosts);
    setFeedSource(source);
    setFeedLoading(false);
    return nextPosts;
  }, []);

  const refreshMatches = useCallback(async (): Promise<Match[]> => {
    setMatchLoading(true);
    const { matches: nextMatches, source } = await loadMatches();
    setMatches(nextMatches);
    setMatchSource(source);
    setMatchLoading(false);
    return nextMatches;
  }, []);

  const removeMatchFromList = useCallback((matchId: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
    setSelectedMatch((prev) => (prev?.id === matchId ? null : prev));
  }, []);

  const handleDismissMatch = useCallback(
    async (match: Match) => {
      setMatchActionError(null);
      const hasApi = Boolean(getApiBaseUrl());
      if (!hasApi) {
        removeMatchFromList(match.id);
        return;
      }
      const ok = await dismissMatch(match.id);
      if (!ok) {
        setMatchActionError('忽略失败，请稍后重试');
        return;
      }
      removeMatchFromList(match.id);
    },
    [removeMatchFromList],
  );

  const handleBlockMatch = useCallback(
    async (match: Match) => {
      setMatchActionError(null);
      const hasApi = Boolean(getApiBaseUrl());
      if (!hasApi) {
        removeMatchFromList(match.id);
        return;
      }
      if (!match.candidateUserId) {
        setMatchActionError('无法拉黑：缺少用户标识');
        return;
      }
      const ok = await blockUser(match.candidateUserId);
      if (!ok) {
        setMatchActionError('拉黑失败，请稍后重试');
        return;
      }
      removeMatchFromList(match.id);
    },
    [removeMatchFromList],
  );

  const handlePostQueued = useCallback(async () => {
    const previousIds = new Set(posts.map((p) => p.id));
    setCurrentTab('feed');
    await pollFeedUntilNewPost(() => refreshFeed(), previousIds, {
      attempts: 8,
      intervalMs: 1500,
    });
  }, [posts, refreshFeed]);

  useEffect(() => {
    if (state !== 'splash') return;
    let cancelled = false;
    void (async () => {
      const base = getApiBaseUrl();
      if (base && getStoredAccessToken()) {
        const me = await fetchMe();
        if (!cancelled && me) {
          setState(me.onboardingComplete ? 'main' : 'onboarding');
          return;
        }
      }
      if (!cancelled) setState('auth');
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  useEffect(() => {
    if (state !== 'main') return;
    let cancelled = false;
    void (async () => {
      setFeedLoading(true);
      setMatchLoading(true);
      const [feedResult, matchResult] = await Promise.all([loadFeed(), loadMatches()]);
      if (!cancelled) {
        setPosts(feedResult.posts);
        setFeedSource(feedResult.source);
        setFeedLoading(false);
        setMatches(matchResult.matches);
        setMatchSource(matchResult.source);
        setMatchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  useEffect(() => {
    if (state !== 'main' || !getApiBaseUrl() || !getStoredAccessToken()) return;

    const handleLive = (msg: LiveWsMessage) => {
      if (msg.type === 'connected') return;
      if (msg.type === 'feed') {
        void refreshFeed();
        return;
      }
      if (msg.type === 'match' || msg.type === 'handoff' || msg.type === 'affinity') {
        void refreshMatches();
      }
    };

    return connectLiveEvents({ onEvent: handleLive });
  }, [state, refreshFeed, refreshMatches]);

  const handleAuthComplete = (session: AuthSession | null) => {
    if (!getApiBaseUrl()) {
      setState('onboarding');
      return;
    }
    if (session?.onboardingComplete) {
      setState('main');
    } else {
      setState('onboarding');
    }
  };

  const selectedPost = selectedPostId ? posts.find((p) => p.id === selectedPostId) : undefined;

  if (state === 'splash') {
    return <SplashScreen onFinish={() => setState('auth')} />;
  }
  if (state === 'auth') {
    return <AuthShell onComplete={handleAuthComplete} />;
  }
  if (state === 'onboarding') {
    return <Onboarding onComplete={() => setState('main')} />;
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-echo-dark text-white relative">
      <div className="pb-20">
        {currentTab === 'feed' && (
          <FeedView
            posts={posts}
            loading={feedLoading}
            source={feedSource}
            onRefresh={() => void refreshFeed()}
            onOpenPost={(id) => setSelectedPostId(id)}
          />
        )}
        {currentTab === 'match' && (
          <MatchView
            matches={matches}
            loading={matchLoading}
            source={matchSource}
            actionError={matchActionError}
            onRefresh={() => void refreshMatches()}
            onSelect={setSelectedMatch}
            onDismiss={(m) => void handleDismissMatch(m)}
            onBlock={(m) => void handleBlockMatch(m)}
            onOpenSession={(id) => setSelectedSessionId(id)}
          />
        )}
        {currentTab === 'clone' && (
          <CloneView onPostQueued={() => void handlePostQueued()} />
        )}
        {currentTab === 'log' && (
          <ActivityLogView
            onOpenPost={(id) => setSelectedPostId(id)}
            onOpenSession={(id) => setSelectedSessionId(id)}
          />
        )}
        {currentTab === 'settings' && <SettingsView onLogout={() => setState('auth')} />}
      </div>

      <AnimatePresence>
        {selectedMatch && (
          <MatchDetailView
            match={selectedMatch}
            onBack={() => setSelectedMatch(null)}
            onDismiss={(m) => void handleDismissMatch(m)}
            onBlock={(m) => void handleBlockMatch(m)}
          />
        )}
        {selectedPostId && (
          <PostDetailView
            postId={selectedPostId}
            initialPost={selectedPost}
            onBack={() => setSelectedPostId(null)}
          />
        )}
        {selectedSessionId && (
          <SessionTranscriptView
            sessionId={selectedSessionId}
            onBack={() => setSelectedSessionId(null)}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-20 glass border-t border-white/10 px-6 flex items-center justify-between z-50">
        {(
          [
            { id: 'feed' as const, icon: <Home className="w-6 h-6" />, label: '动态' },
            { id: 'match' as const, icon: <Sparkles className="w-6 h-6" />, label: '匹配' },
            { id: 'clone' as const, icon: <Fingerprint className="w-6 h-6" />, label: '分身' },
            { id: 'log' as const, icon: <History className="w-6 h-6" />, label: '记录' },
            { id: 'settings' as const, icon: <Settings className="w-6 h-6" />, label: '设置' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCurrentTab(tab.id)}
            className={`flex flex-col items-center gap-1 transition-all ${
              currentTab === tab.id ? 'text-echo-blue' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-bold">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
