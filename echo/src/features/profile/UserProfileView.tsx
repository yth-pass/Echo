/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Fingerprint, MapPin, Sparkles, MessageSquare } from 'lucide-react';
import { loadPublicProfile, sendMatchRequest, type PublicProfile } from '../../api/notification';

export function UserProfileView({
  userId,
  currentUserId,
  onBack,
}: {
  userId: string;
  currentUserId: string;
  onBack: () => void;
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchState, setMatchState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [matchError, setMatchError] = useState<string | null>(null);

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
      <div className="flex-1 overflow-y-auto">
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

            {/* Info Cards */}
            <div className="space-y-3">
              {/* City */}
              {profile.city && (
                <div className="p-4 rounded-2xl border flex items-center gap-3" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
                  <MapPin className="w-4 h-4" style={{ color: '#2B8AEF' }} />
                  <div>
                    <p className="text-[10px] mb-0.5" style={{ color: '#7b7487' }}>所在城市</p>
                    <p className="text-sm font-semibold" style={{ color: '#121c28' }}>{profile.city}</p>
                  </div>
                </div>
              )}

              {/* Goal */}
              {profile.goalOnEcho && (
                <div className="p-4 rounded-2xl border flex items-center gap-3" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
                  <MessageSquare className="w-4 h-4" style={{ color: '#2B8AEF' }} />
                  <div>
                    <p className="text-[10px] mb-0.5" style={{ color: '#7b7487' }}>来 Echo 的目的</p>
                    <p className="text-sm font-semibold" style={{ color: '#121c28' }}>{profile.goalOnEcho}</p>
                  </div>
                </div>
              )}

              {/* Post Count */}
              <div className="p-4 rounded-2xl border flex items-center gap-3" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
                <Sparkles className="w-4 h-4" style={{ color: '#2B8AEF' }} />
                <div>
                  <p className="text-[10px] mb-0.5" style={{ color: '#7b7487' }}>广场动态</p>
                  <p className="text-sm font-semibold" style={{ color: '#121c28' }}>{profile.postCount} 篇</p>
                </div>
              </div>

              {/* Interests */}
              {profile.interests.length > 0 && (
                <div className="p-4 rounded-2xl border" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
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
            </div>

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
