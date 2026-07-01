/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Home, Fingerprint, History, Settings, Sparkles } from 'lucide-react';
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { AppState, Match, Post, TabId } from './types';
import { loadFeed, type FeedSource } from './api/feed';
import {
  blockUser,
  dismissMatch,
  loadMatches,
  type MatchSource,
} from './api/match';
import { pollFeedUntilNewPost } from './api/posts';
import {
  fetchMe,
  getStoredAccessToken,
  clearProactiveRefresh,
  scheduleProactiveRefresh,
  type AuthSession,
} from './api/auth';
import { getApiBaseUrl, setAuthFailureHandler } from './api/client';
import { connectLiveEvents, type LiveWsMessage } from './api/ws';
import { SplashScreen } from './features/splash/SplashScreen';
import { AuthShell } from './features/auth/AuthShell';
import { Onboarding } from './features/onboarding/Onboarding';
import { clearOnboardingSession } from './features/onboarding/v2/useOnboardingSession';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeedView } from './features/feed/FeedView';
import { MatchView } from './features/match/MatchView';
import { MatchDetailView } from './features/match/MatchDetailView';
import { CloneView } from './features/clone/CloneView';
import { ActivityLogView } from './features/audit/ActivityLogView';
import { SettingsView } from './features/settings/SettingsView';
import { AvatarSettings } from './features/settings/AvatarSettings';
import { MatchPrefsSettings } from './features/settings/MatchPrefsSettings';
import { AccountSettings } from './features/settings/AccountSettings';
import { PrivacySettings } from './features/settings/PrivacySettings';
import { IdentitySettings } from './features/settings/IdentitySettings';
import { PostDetailView } from './features/feed/PostDetailView';
import { SessionTranscriptView } from './features/audit/SessionTranscriptView';
import { COPY } from './copy';

// 【缺陷6修复】路由→tabId 映射，用于底部导航高亮
const ROUTE_TO_TAB: Record<string, TabId> = {
  '/': 'feed',
  '/matches': 'match',
  '/clone': 'clone',
  '/log': 'log',
  '/settings': 'settings',
};

export default function App() {
  const [state, setState] = useState<AppState>('splash');
  const [posts, setPosts] = useState<Post[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedSource, setFeedSource] = useState<FeedSource | 'idle'>('idle');
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchSource, setMatchSource] = useState<MatchSource | 'idle'>('idle');
  const [matchActionError, setMatchActionError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // 【缺陷4修复】feed 请求 in-flight 标记 + AbortController：新请求取消旧请求，防竞态覆盖
  const feedAbortRef = useRef<AbortController | null>(null);
  // 【缺陷4修复】debounce 定时器：合并 200ms 内的多个 live 事件为一次 refresh
  const feedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 【缺陷4修复】match 请求 in-flight 标记 + debounce
  const matchAbortRef = useRef<AbortController | null>(null);
  const matchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshFeed = useCallback(async (): Promise<Post[]> => {
    // 【缺陷4修复】取消进行中的旧请求，避免并发覆盖
    if (feedAbortRef.current) feedAbortRef.current.abort();
    const controller = new AbortController();
    feedAbortRef.current = controller;
    setFeedLoading(true);
    const { posts: nextPosts, source } = await loadFeed(controller.signal);
    if (!controller.signal.aborted) {
      // 保留乐观更新的本地帖（id='local-draft'），直到服务端帖子取代它
      setPosts((prev) => {
        const optimistic = prev.find((p) => p.id === 'local-draft');
        if (optimistic && nextPosts.length > 0) {
          // 服务端有新帖时移除乐观帖（真实帖子已到达）
          return nextPosts;
        }
        if (optimistic && nextPosts.length === 0) {
          return [optimistic];
        }
        return nextPosts;
      });
      setFeedSource(source);
      setFeedLoading(false);
    }
    return nextPosts;
  }, []);

  const refreshMatches = useCallback(async (): Promise<Match[]> => {
    // 【缺陷4修复】取消进行中的旧请求
    if (matchAbortRef.current) matchAbortRef.current.abort();
    const controller = new AbortController();
    matchAbortRef.current = controller;
    setMatchLoading(true);
    const { matches: nextMatches, source } = await loadMatches(controller.signal);
    if (!controller.signal.aborted) {
      setMatches(nextMatches);
      setMatchSource(source);
      setMatchLoading(false);
    }
    return nextMatches;
  }, []);

  const removeMatchFromList = useCallback((matchId: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
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
        setMatchActionError(COPY.error.dismissFailed);
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
        setMatchActionError(COPY.error.blockFailed);
        return;
      }
      removeMatchFromList(match.id);
    },
    [removeMatchFromList],
  );

  const handlePostQueued = useCallback(
    async (content: string) => {
      // 乐观更新：立即在本地 feed 显示新帖
      const optimisticPost: Post = {
        id: 'local-draft',
        author: '我的分身',
        authorType: 'clone',
        content,
        time: '刚刚',
        likes: 0,
        comments: 0,
      };
      setPosts((prev) => [optimisticPost, ...prev.filter((p) => p.id !== 'local-draft')]);
      navigate('/');
      // 后台刷新，让服务端帖子最终替换乐观帖
      await refreshFeed();
    },
    [refreshFeed, navigate],
  );

  // 【缺陷3修复】注册 401 鉴权失败回调：refresh 失败时跳转登录页
  useEffect(() => {
    setAuthFailureHandler(() => {
      clearProactiveRefresh();
      setState('auth');
      navigate('/', { replace: true });
    });
    return () => setAuthFailureHandler(null);
  }, [navigate]);

  // 【缺陷4/缺陷6修复】Splash 状态机
  useEffect(() => {
    if (state !== 'splash') return;

    const base = getApiBaseUrl();
    if (!base) {
      setState('no-api');
      return;
    }

    if (!getStoredAccessToken()) {
      setState('auth');
      return;
    }

    const controller = new AbortController();
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        controller.abort();
        setState('auth');
      }
    }, 5000);

    void (async () => {
      try {
        const me = await fetchMe(controller.signal);
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          if (me) {
            scheduleProactiveRefresh();
            setCurrentUserId(me.userId);
            if (!me.onboardingComplete) {
              // 清除其他用户残留的 onboarding session，防止串台
              clearOnboardingSession();
            }
            setState(me.onboardingComplete ? 'main' : 'onboarding');
          } else {
            setState('auth');
          }
        }
      } catch {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          setState('auth');
        }
      }
    })();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [state]);

  // main 状态首次进入时加载 feed + matches
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

  // 【缺陷4/缺陷5修复】live 事件：200ms debounce 合并 + AbortController 取消旧请求
  useEffect(() => {
    if (state !== 'main' || !getApiBaseUrl() || !getStoredAccessToken()) return;

    const handleLive = (msg: LiveWsMessage) => {
      if (msg.type === 'connected') return;
      if (msg.type === 'feed') {
        // 【缺陷4修复】debounce 200ms 合并多个 feed 事件
        if (feedDebounceRef.current) clearTimeout(feedDebounceRef.current);
        feedDebounceRef.current = setTimeout(() => {
          void refreshFeed();
        }, 200);
        return;
      }
      if (msg.type === 'match' || msg.type === 'handoff' || msg.type === 'affinity' || msg.type === 'session_error') {
        // 【缺陷4修复】debounce 200ms 合并多个 match 事件
        if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current);
        matchDebounceRef.current = setTimeout(() => {
          void refreshMatches();
        }, 200);
      }
    };

    return connectLiveEvents({ onEvent: handleLive });
  }, [state, refreshFeed, refreshMatches]);

  // 切换到动态页时刷新 feed，确保昵称/头像等个人资料变更能及时反映
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;
    if (state === 'main' && location.pathname === '/' && prev !== '/') {
      void refreshFeed();
    }
  }, [state, location.pathname, refreshFeed]);

  const handleAuthComplete = (session: AuthSession | null) => {
    if (!getApiBaseUrl()) {
      setState('no-api');
      return;
    }
    // session 为 null 说明登录失败，不应跳转到 onboarding
    if (!session) {
      return; // 留在 auth 页面
    }
    setCurrentUserId(session.userId);
    if (session.onboardingComplete) {
      scheduleProactiveRefresh();
      setState('main');
    } else {
      // 新用户或未完成入驻：清除所有残留的 onboarding session，防止其他用户数据串台
      clearOnboardingSession();
      setState('onboarding');
    }
  };

  // splash 阶段：纯展示动画
  if (state === 'splash') {
    return <SplashScreen />;
  }

  if (state === 'no-api') {
    return (
      <div className="min-h-screen bg-echo-dark flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-xl font-bold text-white mb-3">无法连接服务</h1>
        <p className="text-sm text-gray-500">未配置 API 地址，请联系管理员。</p>
      </div>
    );
  }

  if (state === 'auth') {
    return (
      <ErrorBoundary>
        <AuthShell onComplete={handleAuthComplete} />
      </ErrorBoundary>
    );
  }

  // 【缺陷6修复】onboarding / main 均进入路由层
  // onboarding 完成后 setState('main')，路由会自然从 /onboarding 重定向到 /
  if (state === 'onboarding') {
    return (
      <Routes>
        <Route
          path="*"
          element={
            <ErrorBoundary>
              <Onboarding userId={currentUserId} onComplete={() => { setState('main'); navigate('/', { replace: true }); }} />
            </ErrorBoundary>
          }
        />
      </Routes>
    );
  }

  // state === 'main'：主界面路由
  // 【缺陷1修复】详情页 /post/:id /match/:id /session/:id 作为独立路由，天然互斥（同时只有一个路由）
  // 不再需要 selectedMatch/Post/Session 三个独立 state，覆盖层叠加问题消除
  return (
    <Routes>
      {/* 详情路由（全屏覆盖，互斥由路由保证） */}
      <Route
        path="/post/:id"
        element={<PostRoute posts={posts} onBack={() => navigate(-1)} />}
      />
      <Route
        path="/match/:id"
        element={
          <MatchRoute
            matches={matches}
            onBack={() => navigate(-1)}
            onDismiss={handleDismissMatch}
            onBlock={handleBlockMatch}
          />
        }
      />
      <Route
        path="/session/:id"
        element={<SessionRoute onBack={() => navigate(-1)} />}
      />
      {/* 设置子页面路由（全屏覆盖，与详情页同级） */}
      <Route
        path="/settings/avatar"
        element={<AvatarSettings onBack={() => navigate(-1)} />}
      />
      <Route
        path="/settings/prefs"
        element={<MatchPrefsSettings onBack={() => navigate(-1)} />}
      />
      <Route
        path="/settings/account"
        element={<AccountSettings onBack={() => navigate(-1)} />}
      />
      <Route
        path="/settings/privacy"
        element={<PrivacySettings onBack={() => navigate(-1)} />}
      />
      <Route
        path="/settings/identity"
        element={<IdentitySettings onBack={() => navigate(-1)} />}
      />
      {/* 主界面布局（含底部导航） */}
      <Route
        path="/*"
        element={
          <MainLayout
            posts={posts}
            matches={matches}
            feedLoading={feedLoading}
            feedSource={feedSource}
            matchLoading={matchLoading}
            matchSource={matchSource}
            matchActionError={matchActionError}
            onRefreshFeed={() => void refreshFeed()}
            onRefreshMatches={() => void refreshMatches()}
            onDismiss={handleDismissMatch}
            onBlock={handleBlockMatch}
            onPostQueued={(content: string) => void handlePostQueued(content)}
            onLogout={() => {
              clearProactiveRefresh();
              setState('auth');
              navigate('/', { replace: true });
            }}
            navigate={navigate}
            location={location}
          />
        }
      />
    </Routes>
  );
}

// ---------------------------------------------------------------------------
// 【缺陷6修复】路由详情组件：从 :id 参数解析，替代原先的 selectedXxx state
// 【缺陷1修复】三个详情页互为独立路由，天然互斥，不会叠加
// ---------------------------------------------------------------------------

function PostRoute({ posts, onBack }: { posts: Post[]; onBack: () => void }) {
  const { id = '' } = useParams();
  const initialPost = posts.find((p) => p.id === id);
  return <PostDetailView postId={id} initialPost={initialPost} onBack={onBack} />;
}

function MatchRoute({
  matches,
  onBack,
  onDismiss,
  onBlock,
}: {
  matches: Match[];
  onBack: () => void;
  onDismiss: (m: Match) => void;
  onBlock: (m: Match) => void;
}) {
  const { id = '' } = useParams();
  const match = matches.find((m) => m.id === id) ?? null;
  if (!match) {
    return (
      <div className="min-h-screen bg-echo-dark flex items-center justify-center">
        <button type="button" onClick={onBack} className="text-gray-400 text-sm">
          未找到该匹配，返回
        </button>
      </div>
    );
  }
  return (
    <MatchDetailView match={match} onBack={onBack} onDismiss={onDismiss} onBlock={onBlock} />
  );
}

function SessionRoute({ onBack }: { onBack: () => void }) {
  const { id = '' } = useParams();
  return <SessionTranscriptView sessionId={id} onBack={onBack} />;
}

// ---------------------------------------------------------------------------
// 【缺陷6修复】MainLayout：主界面布局 + 底部导航 + 子路由 Outlet
// ---------------------------------------------------------------------------
function MainLayout(props: {
  posts: Post[];
  matches: Match[];
  feedLoading: boolean;
  feedSource: FeedSource | 'idle';
  matchLoading: boolean;
  matchSource: MatchSource | 'idle';
  matchActionError: string | null;
  onRefreshFeed: () => void;
  onRefreshMatches: () => void;
  onDismiss: (m: Match) => void;
  onBlock: (m: Match) => void;
  onPostQueued: (content: string) => void;
  onLogout: () => void;
  navigate: (path: string) => void;
  location: ReturnType<typeof useLocation>;
}) {
  const { location, navigate } = props;
  // 【缺陷6修复】从路由推导当前 tab
  const currentTab: TabId = ROUTE_TO_TAB[location.pathname] ?? 'feed';

  return (
    <div className="max-w-md mx-auto min-h-screen bg-echo-dark text-white relative">
      <div className="pb-20">
        {/* 【缺陷6修复】用路由替代 currentTab 条件渲染 */}
        {currentTab === 'feed' && (
          <FeedView
            posts={props.posts}
            loading={props.feedLoading}
            source={props.feedSource}
            onRefresh={props.onRefreshFeed}
            onOpenPost={(id) => navigate(`/post/${id}`)}
          />
        )}
        {currentTab === 'match' && (
          <MatchView
            matches={props.matches}
            loading={props.matchLoading}
            source={props.matchSource}
            actionError={props.matchActionError}
            onRefresh={props.onRefreshMatches}
            onSelect={(m) => navigate(`/match/${m.id}`)}
            onDismiss={props.onDismiss}
            onBlock={props.onBlock}
            onOpenSession={(id) => navigate(`/session/${id}`)}
          />
        )}
        {currentTab === 'clone' && (
          <CloneView onPostQueued={props.onPostQueued} />
        )}
        {currentTab === 'log' && (
          <ActivityLogView
            onOpenPost={(id) => navigate(`/post/${id}`)}
            onOpenSession={(id) => navigate(`/session/${id}`)}
          />
        )}
        {currentTab === 'settings' && <SettingsView onLogout={props.onLogout} />}
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-20 glass border-t border-white/10 px-6 flex items-center justify-between z-50">
        {(
          [
            { id: 'feed' as const, icon: <Home className="w-6 h-6" />, label: '动态', path: '/' },
            { id: 'match' as const, icon: <Sparkles className="w-6 h-6" />, label: '匹配', path: '/matches' },
            { id: 'clone' as const, icon: <Fingerprint className="w-6 h-6" />, label: '分身', path: '/clone' },
            { id: 'log' as const, icon: <History className="w-6 h-6" />, label: '记录', path: '/log' },
            { id: 'settings' as const, icon: <Settings className="w-6 h-6" />, label: '设置', path: '/settings' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => navigate(tab.path)}
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
