/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Fingerprint, MapPin, Sparkles, MessageSquare } from 'lucide-react';
import { loadPublicProfile, sendMatchRequest, type PublicProfile } from '../../api/notification';
import { RadarChart } from '../../components/RadarChart';


/**
 * 简洁相对时间格式化（帖内用）。
 */
function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function UserProfileView({
  userId,
  currentUserId,
  onBack,
  onViewAllPosts,
  onOpenPost,
}: {
  userId: string;
  currentUserId: string;
  onBack: () => void;
  onViewAllPosts?: (userId: string) => void;
  onOpenPost?: (postId: string) => void;
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchState, setMatchState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [matchError, setMatchError] = useState<string | null>(null);
  const [personaExpanded, setPersonaExpanded] = useState(false);

  // 滚动位置保存/恢复：点击帖子时存 scrollTop，返回时恢复
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollKey = `user-profile-scroll-${userId}`;

  useEffect(() => {
    if (!loading && scrollRef.current) {
      const saved = sessionStorage.getItem(scrollKey);
      if (saved) {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = parseInt(saved, 10);
          }
        });
      }
    }
  }, [loading, scrollKey]);

  const isSelf = userId === currentUserId;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadPublicProfile(userId).then((p) => {
      if (!cancelled) {
        setProfile(p);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [userId]);

  const handleSendMatch = async () => {
    if (matchState === 'sending' || matchState === 'sent') return;
    setMatchState('sending');
    setMatchError(null);
    const result = await sendMatchRequest(userId);
    if (result.ok) {
      setMatchState('sent');
    } else {
      setMatchState('error');
      setMatchError(result.message ?? '发送失败，请稍后重试');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 max-w-[375px] mx-auto z-[110] flex flex-col"
      style={{ backgroundColor: '#f8f9ff' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b"
        style={{
          backgroundColor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          borderColor: '#d9e3f4',
        }}
      >
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm" style={{ color: '#7b7487' }}>
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <h2 className="font-bold text-sm" style={{ color: '#121c28' }}>用户主页</h2>
        {/* 发起匹配按钮 */}
        {!isSelf && (
          <button
            type="button"
            onClick={handleSendMatch}
            disabled={matchState === 'sending' || matchState === 'sent'}
            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
            style={{
              backgroundColor: matchState === 'sent' ? 'rgba(43,138,239,0.1)' : '#2B8AEF',
              color: matchState === 'sent' ? '#2B8AEF' : '#ffffff',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {matchState === 'sending' ? '发送中...' : matchState === 'sent' ? '已发送' : '发起匹配'}
          </button>
        )}
        {isSelf && <div className="w-20" />}
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#2B8AEF', borderTopColor: 'transparent' }} />
          </div>
        )}

        {!loading && !profile && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm" style={{ color: '#7b7487' }}>无法加载用户资料</p>
          </div>
        )}

        {!loading && profile && (
          <div className="px-5 pt-8 pb-24">
            {/* Avatar + Name */}
            <div className="flex flex-col items-center mb-8">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="w-20 h-20 rounded-full object-cover mb-3"
                  style={{ boxShadow: '0 4px 20px rgba(43,138,239,0.15)' }}
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mb-3"
                  style={{ backgroundColor: 'rgba(43,138,239,0.1)' }}
                >
                  <Fingerprint className="w-10 h-10" style={{ color: '#2B8AEF' }} />
                </div>
              )}
              <h1 className="text-xl font-bold mb-1" style={{ color: '#121c28' }}>
                {profile.displayName}
              </h1>
              {isSelf && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(43,138,239,0.1)', color: '#2B8AEF' }}>
                  这是你
                </span>
              )}
            </div>

            {/* ── 区块 1：人格线索 ── */}
            {profile.personaSketch && Array.isArray(profile.personaSketch.sections) && (
              <div className="p-5 rounded-2xl border mb-4" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: '#121c28' }}>人格线索</h3>
                {(personaExpanded
                  ? profile.personaSketch.sections
                  : profile.personaSketch.sections.slice(0, 3)
                ).map((s) => (
                  <div key={s.key} className="mb-2">
                    <p className="text-[11px] font-semibold" style={{ color: '#2B8AEF' }}>{s.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#7b7487' }}>{s.narrative}</p>
                  </div>
                ))}
                {profile.personaSketch.sections.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setPersonaExpanded(!personaExpanded)}
                    className="text-[11px] font-medium mt-1"
                    style={{ color: '#2B8AEF' }}
                  >
                    {personaExpanded ? '收起' : `查看完整人格画像（共 ${profile.personaSketch.sections.length} 项）`}
                  </button>
                )}
              </div>
            )}

            {/* ── 区块 2：理想型 ── */}
            {profile.idealPartnerSketch && (
              <div className="p-5 rounded-2xl border mb-4" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: '#121c28' }}>理想伴侣</h3>
                <p className="text-xs leading-relaxed mb-4" style={{ color: '#7b7487' }}>
                  {profile.idealPartnerSketch.narrative}
                </p>
                <RadarChart dimensions={profile.idealPartnerSketch.dimensions} size={240} />
              </div>
            )}

            {/* ── 区块 3：广场动态 ── */}
            {Array.isArray(profile.posts) && profile.posts.length > 0 && (
              <div className="p-5 rounded-2xl border mb-4" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold" style={{ color: '#121c28' }}>广场动态</h3>
                  <span className="text-[10px]" style={{ color: '#7b7487' }}>{profile.postCount} 篇</span>
                </div>
                <div className="space-y-3">
                  {profile.posts.map((post) => (
                    <motion.button
                      key={post.id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (scrollRef.current) {
                          sessionStorage.setItem(scrollKey, String(scrollRef.current.scrollTop));
                        }
                        onOpenPost?.(post.id);
                      }}
                      className="w-full text-left border-b pb-3 last:border-b-0 last:pb-0 transition-colors hover:bg-gray-50/50 rounded-lg"
                      style={{ borderColor: '#d9e3f4' }}
                    >
                      <p className="text-xs leading-relaxed mb-1.5 line-clamp-3" style={{ color: '#121c28' }}>
                        {post.content}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: '#7b7487' }}>
                          {formatRelativeTime(post.created_at)}
                        </span>
                        <div className="flex items-center gap-3 text-[10px]" style={{ color: '#7b7487' }}>
                          <span>♥ {post.likes}</span>
                          <span>💬 {post.comments}</span>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
                {profile.postCount > profile.posts.length && (
                  <button
                    type="button"
                    onClick={() => onViewAllPosts?.(userId)}
                    className="w-full mt-3 py-2 text-xs font-medium rounded-xl transition-colors hover:bg-opacity-80"
                    style={{ backgroundColor: 'rgba(43,138,239,0.08)', color: '#2B8AEF' }}
                  >
                    查看全部 {profile.postCount} 篇 →
                  </button>
                )}
              </div>
            )}

            {/* ── 城市 ── */}
            {profile.city && (
              <div className="p-4 rounded-2xl border flex items-center gap-3 mb-4" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
                <MapPin className="w-4 h-4" style={{ color: '#2B8AEF' }} />
                <div>
                  <p className="text-[10px] mb-0.5" style={{ color: '#7b7487' }}>所在城市</p>
                  <p className="text-sm font-semibold" style={{ color: '#121c28' }}>{profile.city}</p>
                </div>
              </div>
            )}

            {/* ── 来 Echo 的目的 ── */}
            {profile.goalOnEcho && (
              <div className="p-4 rounded-2xl border flex items-center gap-3 mb-4" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
                <MessageSquare className="w-4 h-4" style={{ color: '#2B8AEF' }} />
                <div>
                  <p className="text-[10px] mb-0.5" style={{ color: '#7b7487' }}>来 Echo 的目的</p>
                  <p className="text-sm font-semibold" style={{ color: '#121c28' }}>{profile.goalOnEcho}</p>
                </div>
              </div>
            )}

            {/* ── 兴趣爱好 ── */}
            {Array.isArray(profile.interests) && profile.interests.length > 0 && (
              <div className="p-4 rounded-2xl border mb-4" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
                <p className="text-[10px] mb-2" style={{ color: '#7b7487' }}>兴趣爱好</p>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                      style={{ backgroundColor: 'rgba(43,138,239,0.08)', color: '#2B8AEF' }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Match error message */}
            {matchState === 'error' && matchError && (
              <div className="mt-4 p-3 rounded-2xl border text-center" style={{ backgroundColor: 'rgba(186,26,26,0.08)', borderColor: 'rgba(186,26,26,0.2)' }}>
                <p className="text-xs" style={{ color: '#ba1a1a' }}>{matchError}</p>
              </div>
            )}

            {/* Match success message */}
            {matchState === 'sent' && (
              <div className="mt-4 p-3 rounded-2xl border text-center" style={{ backgroundColor: 'rgba(43,138,239,0.08)', borderColor: 'rgba(43,138,239,0.2)' }}>
                <p className="text-xs" style={{ color: '#2B8AEF' }}>匹配邀请已发送，等待对方回复</p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
