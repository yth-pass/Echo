/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, CheckCheck, MessageSquare, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  loadNotifications,
  loadUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  acceptMatchRequest,
  deleteNotification,
  type NotificationItem,
} from '../../api/notification';

function formatNotificationTime(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

const TYPE_ICON: Record<string, string> = {
  match_request: '✨',
  match_accepted: '🎉',
  comment: '💬',
  reply: '↩️',
  comment_reply: '💬',
};

export function NotificationBell({ onRefresh }: { onRefresh?: () => void }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fetch unread count periodically
  const fetchUnread = useCallback(async () => {
    const count = await loadUnreadCount();
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    void fetchUnread();
    const interval = setInterval(() => void fetchUnread(), 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // Expose refresh method via parent's onRefresh callback
  useEffect(() => {
    if (onRefresh) onRefresh();
  }, [unreadCount, onRefresh]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = async () => {
    if (!open) {
      setLoading(true);
      const items = await loadNotifications();
      setNotifications(items);
      setLoading(false);
    }
    setOpen(!open);
  };

  const handleMarkRead = async (item: NotificationItem) => {
    if (!item.read) {
      await markNotificationRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleAcceptMatch = async (item: NotificationItem) => {
    if (!item.ref_id) return;
    const result = await acceptMatchRequest(item.ref_id);
    if (result.ok) {
      await handleMarkRead(item);
      // Refresh notifications
      const items = await loadNotifications();
      setNotifications(items);
    }
  };

  const handleDelete = async (item: NotificationItem) => {
    await deleteNotification(item.id);
    setNotifications((prev) => prev.filter((n) => n.id !== item.id));
    if (!item.read) setUnreadCount((c) => Math.max(0, c - 1));
  };

  // 回复按钮 / 卡片点击：标记已读 + 跳转到对应帖子详情
  const handleReplyJump = async (item: NotificationItem) => {
    await handleMarkRead(item);
    setOpen(false);
    const postId = item.metadata?.postId ?? item.ref_id;
    if (postId) navigate(`/post/${postId}`);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={handleOpen}
        className="relative p-1.5 rounded-full transition-colors"
        style={{ color: open ? '#2B8AEF' : '#7b7487' }}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{ backgroundColor: '#ba1a1a', color: '#ffffff' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-10 w-[320px] max-h-[420px] rounded-2xl border overflow-hidden flex flex-col z-[200]"
            style={{
              backgroundColor: '#ffffff',
              borderColor: '#d9e3f4',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}
          >
            {/* Panel header */}
            <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: '#d9e3f4' }}>
              <h3 className="text-sm font-bold" style={{ color: '#121c28' }}>通知</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-[10px] font-bold"
                  style={{ color: '#2B8AEF' }}
                >
                  <CheckCheck className="w-3 h-3" />
                  全部已读
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="p-6 text-center">
                  <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: '#2B8AEF', borderTopColor: 'transparent' }} />
                </div>
              )}

              {!loading && notifications.length === 0 && (
                <div className="p-6 text-center">
                  <Bell className="w-8 h-8 mx-auto mb-2" style={{ color: '#d9e3f4' }} />
                  <p className="text-xs" style={{ color: '#7b7487' }}>暂无通知</p>
                </div>
              )}

              {!loading &&
                notifications.map((item) => {
                  // 评论被回复：B 站风格卡片
                  // （评论者名 / 动作 / 新评论内容 / 时间 / 回复+删除该通知 / 灰色引用原评论）
                  if (item.type === 'comment_reply' && item.metadata) {
                    const meta = item.metadata;
                    return (
                      <div
                        key={item.id}
                        className="px-4 py-3 border-b last:border-b-0 transition-colors cursor-pointer"
                        style={{
                          borderColor: '#f0f4ff',
                          backgroundColor: item.read ? 'transparent' : 'rgba(43,138,239,0.04)',
                        }}
                        onClick={() => void handleReplyJump(item)}
                      >
                        {/* 评论者名 + 动作 */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageSquare className="w-3 h-3 shrink-0" style={{ color: '#2B8AEF' }} />
                          <span className="text-xs font-bold truncate" style={{ color: '#121c28' }}>
                            {meta.actorName ?? item.title}
                          </span>
                          <span className="text-[11px]" style={{ color: '#7b7487' }}>
                            {item.body}
                          </span>
                          {!item.read && (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0 ml-auto"
                              style={{ backgroundColor: '#2B8AEF' }}
                            />
                          )}
                        </div>
                        {/* 新评论内容 */}
                        {meta.replyContent && (
                          <p className="text-[12px] leading-relaxed mb-1.5" style={{ color: '#121c28' }}>
                            {meta.replyContent}
                          </p>
                        )}
                        {/* 时间 + 操作按钮 */}
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="text-[9px]" style={{ color: '#7b7487' }}>
                            {formatNotificationTime(item.created_at)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleReplyJump(item);
                            }}
                            className="text-[10px] font-bold"
                            style={{ color: '#2B8AEF' }}
                          >
                            回复
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDelete(item);
                            }}
                            className="flex items-center gap-0.5 text-[10px] font-bold"
                            style={{ color: '#7b7487' }}
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            删除该通知
                          </button>
                        </div>
                        {/* 灰色引用块：被回复的原评论 */}
                        {meta.quotedComment?.content && (
                          <div
                            className="rounded-md px-2.5 py-1.5 text-[11px] leading-relaxed"
                            style={{
                              backgroundColor: '#f0f4ff',
                              color: '#7b7487',
                              borderLeft: '2px solid #d9e3f4',
                            }}
                          >
                            {meta.quotedComment.content}
                          </div>
                        )}
                      </div>
                    );
                  }
                  // 其他类型：原有渲染（追加一个轻量删除图标按钮）
                  return (
                    <div
                      key={item.id}
                      className="px-4 py-3 flex gap-3 border-b last:border-b-0 transition-colors cursor-pointer"
                      style={{
                        borderColor: '#f0f4ff',
                        backgroundColor: item.read ? 'transparent' : 'rgba(43,138,239,0.04)',
                      }}
                      onClick={() => void handleMarkRead(item)}
                    >
                      <span className="text-base shrink-0 mt-0.5">{TYPE_ICON[item.type] ?? '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold truncate" style={{ color: '#121c28' }}>
                            {item.title}
                          </span>
                          {!item.read && (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: '#2B8AEF' }}
                            />
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed mb-1" style={{ color: '#4a4455' }}>
                          {item.body}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px]" style={{ color: '#7b7487' }}>
                            {formatNotificationTime(item.created_at)}
                          </span>
                          {/* Accept button for match_request notifications */}
                          {item.type === 'match_request' && item.ref_id && !item.read && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleAcceptMatch(item);
                              }}
                              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: '#2B8AEF', color: '#ffffff' }}
                            >
                              <Check className="w-3 h-3" />
                              接受
                            </button>
                          )}
                          {/* 删除通知 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDelete(item);
                            }}
                            className="flex items-center gap-0.5 text-[10px] font-bold ml-auto"
                            style={{ color: '#7b7487' }}
                            aria-label="删除该通知"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
