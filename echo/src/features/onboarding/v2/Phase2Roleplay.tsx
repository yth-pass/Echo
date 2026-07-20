/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 2 — 4 角色对话聊天界面
 * 角色选择屏 ↔ WeChat 风格聊天屏
 *
 * 修复项：
 * - #7 角色介绍便签
 * - #8 语气提醒横幅
 * - #9 输入框不再被 apiPending 阻塞
 * - #10 头部固定（微信风格）
 * - #11 切换 agent 时清理 timers 防串台
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Info } from 'lucide-react';
import { ROLEPLAY_ROLES } from './roleplay-agents.data';
import { RoleCard } from './components/RoleCard';
import { ChatBubble } from './components/ChatBubble';
import { TypingIndicator } from './components/TypingIndicator';
import {
  startRoleplay,
  sendRoleplayTurn,
  endRoleplay,
  extractRoleplayStyle,
  generateAgentProfiles,
  listRoleplayChats,
} from './onboarding-v2.api';
import type { AgentProfilesResponse } from './onboarding-v2.api';
import { COPY } from '../../../copy';
import type {
  ChatMessage,
  PhaseProps,
  RoleId,
  RoleplayConversation,
} from './onboarding-v2.types';

const MIN_TURNS = 6;
const MAX_TURNS = 15;

/** P0 阶段需要完成的角色 */
const P0_REQUIRED_ROLES: RoleId[] = ['bestfriend', 'crush', 'stranger', 'disappointed'];

/** 角色关系描述映射（用于语气提醒） */
const ROLE_RELATIONSHIP: Record<RoleId, string> = {
  bestfriend: '最懂你的老朋友',
  crush: '让你心跳加速的暧昧对象',
  stranger: '刚认识的有趣灵魂',
  disappointed: '有过好感但让你失望的人',
};

const ROLE_TONE_HINT: Record<RoleId, string> = {
  bestfriend: '这是根据你的经历生成的个性化角色，请用平时跟很聊得来的朋友说话的语气沟通',
  crush: '这是根据你的经历生成的个性化暧昧对象性格，请用平时跟暧昧对象聊天的语气沟通',
  stranger: '这是根据你的经历生成的个性化角色，请用自然的语气沟通',
  disappointed: '这是根据你的经历生成的个性化角色，请用面对让你失望的人时的语气沟通',
};

let msgIdCounter = 0;
function nextMsgId(): string {
  return `msg-${++msgIdCounter}`;
}

// ─── Phase 2 localStorage 持久化 ──────────────────────────────────────────────

const VALID_ROLE_IDS: RoleId[] = ['bestfriend', 'crush', 'stranger', 'disappointed'];

function p2Key(userId: string, roleId: RoleId) {
  return `echo_phase2_conv_${userId}_${roleId}`;
}

function saveConversation(userId: string, conv: RoleplayConversation): void {
  try {
    localStorage.setItem(p2Key(userId, conv.roleId), JSON.stringify({
      chatId: conv.chatId,
      roleId: conv.roleId,
      messages: conv.messages,
      turnCount: conv.turnCount,
      // C2 修复：持久化 pendingDisplayIds（数组形式便于 JSON 序列化）
      pendingDisplayIds: Array.from(conv.pendingDisplayIds ?? []),
    }));
  } catch { /* silent */ }
}

function loadConversation(userId: string, roleId: RoleId): RoleplayConversation | null {
  try {
    const raw = localStorage.getItem(p2Key(userId, roleId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // C2 修复：反序列化 pendingDisplayIds（兼容旧数据：无字段时返回空 Set）
    return {
      ...parsed,
      pendingDisplayIds: new Set<string>(parsed.pendingDisplayIds ?? []),
      status: 'active',
    } as RoleplayConversation;
  } catch {
    return null;
  }
}

function removeConversation(userId: string, roleId: RoleId): void {
  try { localStorage.removeItem(p2Key(userId, roleId)); } catch { /* silent */ }
}

function loadCompletedRoles(userId: string): RoleId[] {
  try {
    const raw = localStorage.getItem(`echo_phase2_completed_${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RoleId[];
    return parsed.filter((r) => VALID_ROLE_IDS.includes(r));
  } catch {
    return [];
  }
}

function saveCompletedRoles(userId: string, roles: RoleId[]): void {
  try { localStorage.setItem(`echo_phase2_completed_${userId}`, JSON.stringify(roles)); } catch { /* silent */ }
}

function loadUnreadCounts(userId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`echo_phase2_unread_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUnreadCounts(userId: string, counts: Record<string, number>): void {
  try { localStorage.setItem(`echo_phase2_unread_${userId}`, JSON.stringify(counts)); } catch { /* silent */ }
}

export function Phase2Roleplay({ userId, onComplete }: PhaseProps & { userId: string }) {
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [conversation, setConversation] = useState<RoleplayConversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [apiPending, setApiPending] = useState(false);
  const [completedRoles, setCompletedRoles] = useState<RoleId[]>([]);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(true);
  const [agentProfiles, setAgentProfiles] = useState<AgentProfilesResponse | null>(null);
  const [unreadCount, setUnreadCount] = useState<Record<string, number>>({});
  const [savedConversations, setSavedConversations] = useState<Record<RoleId, RoleplayConversation>>({} as Record<RoleId, RoleplayConversation>);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // C3 修复：pendingDisplayIds 已合并进 conversation 对象（不再用独立 state）
  // 设计原理：把"消息存在性"和"消息可见性"绑定在同一个对象上，避免双 state 不同步
  /** 实时追踪当前正在查看的 roleId（避免异步回调中闭包过期） */
  const viewingRoleIdRef = useRef<RoleId | null>(null);
  viewingRoleIdRef.current = conversation?.roleId ?? null;

  /** 清理所有打字动画 timers（#11 防串台核心修复） */
  const clearAllTimers = useCallback(() => {
    typingTimersRef.current.forEach(clearTimeout);
    typingTimersRef.current = [];
  }, []);

  /** C3 辅助：通过 setConversation updater 更新 pendingDisplayIds（替代原 setPendingMsgIds） */
  const setPendingDisplayIds = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      setConversation((prev) => {
        if (!prev) return prev;
        return { ...prev, pendingDisplayIds: updater(prev.pendingDisplayIds) };
      });
    },
    [],
  );

  // 自动滚到底部（消息新增 或 逐条视觉展示时均触发）
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages, conversation?.pendingDisplayIds]);

  // 组件卸载时清理 + C5 修复：把 pending 消息标为未读（处理整体退出 onboarding 时 pending 丢失）
  useEffect(() => {
    return () => {
      // C5：组件卸载前把 pending 消息标为未读 + 确保 conversation 已持久化
      // 处理场景：用户在打字动画进行中按 X 退出整个 onboarding（handleExit 触发 unmount）
      // 原代码：clearAllTimers 后 pending 消息静默丢失，未读数不变 → 气泡数字错误
      if (conversation && conversation.pendingDisplayIds.size > 0) {
        const roleId = conversation.roleId;
        const count = conversation.pendingDisplayIds.size;
        // 确保 conversation（含 pendingDisplayIds）已持久化，下次进入可恢复动画
        saveConversation(userId, conversation);
        // 直接写 localStorage 累加未读数（setState 在 unmount 后不生效）
        try {
          const raw = localStorage.getItem(`echo_phase2_unread_${userId}`);
          const current: Record<string, number> = raw ? JSON.parse(raw) : {};
          current[roleId] = (current[roleId] ?? 0) + count;
          localStorage.setItem(`echo_phase2_unread_${userId}`, JSON.stringify(current));
        } catch { /* silent */ }
      }
      clearAllTimers();
    };
  }, [clearAllTimers, conversation, userId]);

  // 挂载时获取已生成的角色档案（幂等：已存在则直接返回缓存）
  useEffect(() => {
    generateAgentProfiles()
      .then((profiles) => {
        if (profiles) setAgentProfiles(profiles);
      })
      .catch(() => {
        // 静默失败，角色介绍便签显示 fallback
      });
  }, []);

  // 挂载时从 localStorage 恢复 Phase 2 进度
  useEffect(() => {
    // 恢复已完成角色
    const cr = loadCompletedRoles(userId);
    setCompletedRoles(cr);
    // 恢复未读计数
    const uc = loadUnreadCounts(userId);
    setUnreadCount(uc);
    // 恢复进行中的对话
    const restored: Record<RoleId, RoleplayConversation> = {} as Record<RoleId, RoleplayConversation>;
    for (const roleId of VALID_ROLE_IDS) {
      const conv = loadConversation(userId, roleId);
      if (conv) restored[roleId] = conv;
    }
    setSavedConversations(restored);
  }, [userId]);

  // B1 修复：挂载后调后端 listRoleplayChats 同步 completedRoles（以后端为权威）
  // 防止 localStorage 与后端状态不同步导致死循环：
  //   - 后端 chat 已 ended 但 localStorage 没 completedRoles → 用户点进去 400 死循环
  //   - 后端 chat 未 ended 但 localStorage 标了 completed → 用户漏聊
  useEffect(() => {
    let cancelled = false;
    listRoleplayChats()
      .then((chats) => {
        if (cancelled) return;
        const completedFromBackend = chats
          .filter((c) => c.status === 'ended')
          .map((c) => c.roleName);
        // 以后端为准（取并集，避免后端漏报时丢失本地进度）
        setCompletedRoles((prev) => {
          const merged = new Set(prev);
          for (const r of completedFromBackend) merged.add(r);
          const next = Array.from(merged);
          // 同步到 localStorage
          if (userId) saveCompletedRoles(userId, next);
          return next;
        });
        // 清理后端已结束但 localStorage 仍保留的 conversation（避免下次进入 loadConversation 拿到旧 chatId）
        for (const chat of chats) {
          if (chat.status === 'ended') {
            removeConversation(userId, chat.roleName);
          }
        }
        setSavedConversations((prev) => {
          const next = { ...prev };
          for (const chat of chats) {
            if (chat.status === 'ended') {
              delete next[chat.roleName as RoleId];
            }
          }
          return next;
        });
      })
      .catch(() => {
        // 静默失败：降级到 localStorage 已恢复的 completedRoles
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 持久化：对话状态变化时保存到 localStorage
  useEffect(() => {
    if (!conversation || !userId) return;
    saveConversation(userId, conversation);
  }, [conversation, userId]);

  // C6 修复：当 conversation 有 pendingDisplayIds 但 timers 为空时，自动重启打字动画
  // 处理场景：用户退回角色屏时 pendingDisplayIds 被持久化，下次进入 loadConversation 恢复后
  // 需要重启 setTimeout 动画逐条展示（否则所有消息会立即显示，丧失"逐条弹出"的体验）
  useEffect(() => {
    if (!conversation) return;
    if (conversation.pendingDisplayIds.size === 0) return;
    if (typingTimersRef.current.length > 0) return; // 已有动画进行中，不重复启动

    const pendingIds = Array.from(conversation.pendingDisplayIds);
    let cumulativeDelay = 0;
    pendingIds.forEach((msgId) => {
      // 每条消息默认 800ms 延迟（与 handleSend 中的 fallback 一致）
      cumulativeDelay += 800;
      const timer = setTimeout(() => {
        setPendingDisplayIds((prev) => {
          const next = new Set(prev);
          next.delete(msgId);
          if (next.size === 0) setIsTyping(false);
          return next;
        });
      }, cumulativeDelay);
      typingTimersRef.current.push(timer);
    });

    // 重启动画时同步设置 isTyping（让 TypingIndicator 显示）
    setIsTyping(true);

    return () => {
      // 清理本次 effect 启动的 timers（但不清 typingTimersRef，让 clearAllTimers 统一管理）
      // 实际上 typingTimersRef 已被 push，clearAllTimers 会统一清理
    };
  }, [conversation?.pendingDisplayIds, conversation, setPendingDisplayIds]);

  // 持久化：已完成角色变化时保存
  useEffect(() => {
    if (userId) saveCompletedRoles(userId, completedRoles);
  }, [completedRoles, userId]);

  // 持久化：未读计数变化时保存
  useEffect(() => {
    if (userId) saveUnreadCounts(userId, unreadCount);
  }, [unreadCount, userId]);

  // 选择角色 → 开始对话
  // B2 修复：始终调 startRoleplay 拿后端权威状态，不再 loadConversation 优先
  // 防止"localStorage conv 用旧 chatId → 后端已 ended → 400 死循环"
  const handleSelectRole = async (roleId: RoleId) => {
    setSelectedRole(roleId);
    setError(null);
    clearAllTimers(); // #11 切换角色时清理旧 timers
    setIsTyping(false);
    setPendingDisplayIds(() => new Set()); // C3：清空 pendingDisplayIds
    setApiPending(false);
    setInputText('');

    // 清除该角色的未读计数
    setUnreadCount((prev) => {
      if (!prev[roleId]) return prev;
      const next = { ...prev };
      delete next[roleId];
      return next;
    });

    try {
      const result = await startRoleplay(roleId);
      if (!result) {
        setError('无法开始对话，请重试');
        setSelectedRole(null);
        return;
      }

      // 后端报告对话已结束 → 自动标记完成，停留角色屏
      // 这是 Bug ② 死循环修复的核心：前端识别 ended 后立即把 roleId 加入 completedRoles
      if (result.status === 'ended') {
        setCompletedRoles((prev) =>
          prev.includes(roleId) ? prev : [...prev, roleId],
        );
        removeConversation(userId, roleId);
        setSavedConversations((prev) => {
          const next = { ...prev };
          delete next[roleId];
          return next;
        });
        setUnreadCount((prev) => {
          if (!prev[roleId]) return prev;
          const next = { ...prev };
          delete next[roleId];
          return next;
        });
        setError('这个角色已经聊过了，去和其他角色聊聊吧');
        setSelectedRole(null);
        return;
      }

      // active 状态 → 用后端返回的 chatId 初始化（不读 localStorage 的 messages）
      const initialMessages: ChatMessage[] = [
        {
          id: 'init-0',
          role: 'assistant',
          segments: [result.openingMessage],
          displayedSegments: 1,
          timestamp: Date.now(),
        },
      ];

      const newConv: RoleplayConversation = {
        roleId,
        chatId: result.chatId,
        messages: initialMessages,
        turnCount: 0,
        status: 'active',
        pendingDisplayIds: new Set(), // C3：新对话初始无 pending
      };
      setConversation(newConv);
      saveConversation(userId, newConv);

      // 开场白未读，标记角标
      setUnreadCount((prev) => ({ ...prev, [roleId]: 1 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '无法开始对话，请重试');
      setSelectedRole(null);
    }
  };

  // 发送消息 — 支持后台处理：API 请求期间用户可退出，回复到达后自动存入 localStorage + 标记未读
  const handleSend = async () => {
    if (!conversation || !inputText.trim() || apiPending) return;
    if (conversation.turnCount >= MAX_TURNS) return;

    // 捕获当前对话标识（API 响应到达时 conversation state 可能已被清空）
    const targetRoleId = conversation.roleId;
    const chatId = conversation.chatId;

    const userMsg: ChatMessage = {
      id: nextMsgId(),
      role: 'user',
      segments: [inputText.trim()],
      displayedSegments: 1,
      timestamp: Date.now(),
    };

    const newTurnCount = conversation.turnCount + 1;
    // 注意：不清 timers 也不清 pendingDisplayIds —— agent 的打字动画继续，user 消息立即显示
    setConversation((prev) =>
      prev?.roleId === targetRoleId
        ? { ...prev, messages: [...prev.messages, userMsg], turnCount: newTurnCount }
        : prev,
    );
    const msgText = inputText.trim();
    setInputText('');
    setApiPending(true);
    setIsTyping(true);

    // 30 秒超时，防止请求挂起导致 apiPending 永远卡住
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 30_000);

    try {
      const res = await sendRoleplayTurn(chatId, msgText, ac.signal);

      // 400 错误（对话已结束 / 不存在）
      if (res.ok === false) {
        // B3 修复：解析错误信息，识别"对话已结束"，把 roleId 加入 completedRoles 防止死循环
        // 用 res.ok === false 显式 narrow（比 !res.ok 更可靠地收敛 union 类型）
        const errorMsg = res.message ?? '';
        const isChatEnded = errorMsg.includes('对话已结束') || res.status === 400;

        if (isChatEnded) {
          // 后端说对话已结束 → 标记完成 + 清理 localStorage（防止下次又拿旧 chatId 进入死循环）
          setCompletedRoles((prev) =>
            prev.includes(targetRoleId) ? prev : [...prev, targetRoleId],
          );
          removeConversation(userId, targetRoleId);
          setSavedConversations((prev) => {
            const next = { ...prev };
            delete next[targetRoleId];
            return next;
          });
          setUnreadCount((prev) => {
            if (!prev[targetRoleId]) return prev;
            const next = { ...prev };
            delete next[targetRoleId];
            return next;
          });
        }

        if (viewingRoleIdRef.current === targetRoleId) {
          setIsTyping(false);
          // C3：setConversation(null) 会自动清空 pendingDisplayIds，无需单独清
          clearAllTimers();
          setConversation(null);
          setSelectedRole(null);
          // 仅非"已结束"错误才把消息回填输入框（已结束时回填无意义）
          if (!isChatEnded) {
            setInputText(msgText);
          }
        }
        return;
      }

      const data = res.data!;

      // 后端 auto-farewell 标记：对话已自然结束
      if (data.ended || data.replies.length === 0) {
        // B3 修复：自然告别结束时把角色标记为完成（原代码遗漏此步骤导致死循环）
        setCompletedRoles((prev) =>
          prev.includes(targetRoleId) ? prev : [...prev, targetRoleId],
        );
        removeConversation(userId, targetRoleId);
        setSavedConversations((prev) => {
          const next = { ...prev };
          delete next[targetRoleId];
          return next;
        });
        setUnreadCount((prev) => {
          if (!prev[targetRoleId]) return prev;
          const next = { ...prev };
          delete next[targetRoleId];
          return next;
        });

        if (viewingRoleIdRef.current === targetRoleId) {
          setIsTyping(false);
          // C3：setConversation(null) 会自动清空 pendingDisplayIds
          clearAllTimers();
          setConversation(null);
          setSelectedRole(null);
        }
        return;
      }

      // 构建 agent 回复消息（用唯一前缀防 ID 冲突）
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const assistantMsgs: ChatMessage[] = data.replies.map((reply, idx) => ({
        id: `${batchId}-${idx}`,
        role: 'assistant' as const,
        segments: [reply.content],
        displayedSegments: 1,
        timestamp: Date.now(),
      }));
      const newIds = new Set(assistantMsgs.map((m) => m.id));

      // ── 核心：无论用户是否在看这个聊天，都要存储消息（带去重） ──
      setConversation((prev) => {
        if (prev?.roleId === targetRoleId) {
          // 用户正在看这个聊天 → 加入 state（useEffect 自动持久化）
          // 去重：检查是否已有同 batchId 的消息（防止 updater 重复执行）
          if (prev.messages.some((m) => newIds.has(m.id))) return prev;
          clearAllTimers();
          return { ...prev, messages: [...prev.messages, ...assistantMsgs] };
        }
        // 用户已退出或在看别的聊天 → 直接写入 localStorage（带去重）
        const saved = loadConversation(userId, targetRoleId);
        if (saved) {
          const existingIds = new Set(saved.messages.map((m) => m.id));
          const deduped = assistantMsgs.filter((m) => !existingIds.has(m.id));
          if (deduped.length > 0) {
            saveConversation(userId, {
              ...saved,
              messages: [...saved.messages, ...deduped],
            });
            // 标记未读（agent 在"后台"发了消息）
            setUnreadCount((uc) => ({
              ...uc,
              [targetRoleId]: (uc[targetRoleId] ?? 0) + deduped.length,
            }));
          }
        }
        return prev; // 不改变当前显示的聊天
      });

      // API 响应已处理完毕，立即解除发送锁定（打字动画不妨碍用户发下一条）
      setApiPending(false);

      // ── 视觉动画（仅当用户正在看这个聊天时启动） ──
      if (viewingRoleIdRef.current === targetRoleId) {
        clearAllTimers();
        // C3：把新消息 ID 合并进 pendingDisplayIds（旧的还在继续弹，不受影响）
        setPendingDisplayIds((prev) => new Set([...prev, ...newIds]));

        let cumulativeDelay = 0;
        assistantMsgs.forEach((msg, idx) => {
          const typingDelay = data.replies[idx].delayMs > 0 ? data.replies[idx].delayMs : 800 + idx * 600;
          cumulativeDelay += typingDelay;
          const msgId = msg.id;
          const timer = setTimeout(() => {
            // C3：通过 setConversation updater 移除单条 msgId
            setPendingDisplayIds((prev) => {
              const next = new Set(prev);
              next.delete(msgId);
              if (next.size === 0) setIsTyping(false);
              return next;
            });
          }, cumulativeDelay);
          typingTimersRef.current.push(timer);
        });
      }
    } catch {
      // API 失败或超时：仅在用户仍在看这个聊天时回滚
      if (viewingRoleIdRef.current === targetRoleId) {
        setIsTyping(false);
        setPendingDisplayIds(() => new Set()); // C3：清空 pendingDisplayIds
        clearAllTimers();
        setConversation((prev) => {
          if (!prev || prev.roleId !== targetRoleId) return prev;
          return {
            ...prev,
            messages: prev.messages.filter((m) => m.id !== userMsg.id),
            turnCount: prev.turnCount - 1,
          };
        });
        setInputText(msgText);
      }
    } finally {
      clearTimeout(timeoutId);
      setApiPending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 结束对话（#12 修复：确保跳转 finalize）
  // B4 修复：endRoleplay 网络失败时仍推进前端，避免网络问题卡死入驻流程
  // （后端 chat 留 active，下次进入会让用户重聊——可接受降级）
  const handleEnd = async () => {
    if (!conversation || ending) return;
    setEnding(true);
    clearAllTimers();
    setPendingDisplayIds(() => new Set()); // C3：清空 pendingDisplayIds

    let endSuccess = false;
    try {
      await endRoleplay(conversation.chatId);
      endSuccess = true;
    } catch (e) {
      // 网络失败：仍推进前端，后端 chat 留 active，下次进入让用户重聊
      console.warn('[Phase2] endRoleplay failed, proceeding locally:', e);
    }
    // endSuccess 仅用于日志，不影响后续逻辑（无论后端是否标记 ended，前端都推进）
    void endSuccess;

    // 清理该角色的 localStorage（对话 + 未读）
    removeConversation(userId, conversation.roleId);
    setSavedConversations((prev) => {
      const next = { ...prev };
      delete next[conversation.roleId];
      return next;
    });
    setUnreadCount((prev) => {
      if (!prev[conversation.roleId]) return prev;
      const next = { ...prev };
      delete next[conversation.roleId];
      return next;
    });

    const newCompleted = [...completedRoles, conversation.roleId];
    setCompletedRoles(newCompleted);
    setConversation(null);
    setSelectedRole(null);
    setEnding(false);

    const allDone = P0_REQUIRED_ROLES.every((r) => newCompleted.includes(r));
    if (allDone) {
      // 提取风格后立即跳转 finalize
      try {
        await extractRoleplayStyle();
      } catch {
        // 即使风格提取失败也不阻塞入驻流程
      }
      onComplete();
    }
  };

  const handleBackToRoles = () => {
    // C4 修复：尚未视觉展示的消息 → 标记为未读（累加，不覆盖之前累计）
    // 关键改动：不再清空 pendingDisplayIds —— 让它随 conversation 持久化到 localStorage
    // 下次进入时 loadConversation 会恢复 pendingDisplayIds，自动重启打字动画
    if (conversation && conversation.pendingDisplayIds.size > 0) {
      const roleId = conversation.roleId;
      const pendingCount = conversation.pendingDisplayIds.size;
      // 累加未读（原代码用 = 覆盖，会丢失之前累计的未读数）
      setUnreadCount((prev) => ({
        ...prev,
        [roleId]: (prev[roleId] ?? 0) + pendingCount,
      }));
      // 确保 conversation（含 pendingDisplayIds）已持久化，下次进入可恢复动画
      saveConversation(userId, conversation);
    }
    clearAllTimers();
    setIsTyping(false);
    // C4：不再 setPendingDisplayIds(() => new Set()) —— 让 pendingDisplayIds 随 conversation 持久化
    setApiPending(false);
    setConversation(null);
    setSelectedRole(null);
    setInputText('');
  };

  // ─── 角色选择屏 ───────────────────────────────────────
  if (!conversation) {
    return (
      <div className="min-h-screen flex flex-col max-w-[375px] mx-auto p-6" style={{ backgroundColor: '#f8f9ff' }}>
        <div className="mb-6">
          <h2 className="text-xl font-bold" style={{ color: '#121c28' }}>和 TA 们聊聊</h2>
          <p className="text-xs mt-1" style={{ color: '#7b7487' }}>
            每个角色聊 6-15 轮，帮助我们捕捉你的语言风格
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {ROLEPLAY_ROLES.map((role) => (
            <RoleCard
              key={role.roleId}
              role={role}
              completed={completedRoles.includes(role.roleId)}
              unreadCount={unreadCount[role.roleId] ?? 0}
              onClick={() => handleSelectRole(role.roleId)}
            />
          ))}
        </div>

        {error && <p className="text-xs mt-4" style={{ color: '#ba1a1a' }}>{error}</p>}

        <p className="text-[10px] mt-6 text-center" style={{ color: '#7b7487' }}>
          需完成全部 4 个角色的对话（已完成 {completedRoles.length}/{P0_REQUIRED_ROLES.length}）
        </p>
      </div>
    );
  }

  // ─── 聊天屏 ──────────────────────────────────────────
  const roleInfo = ROLEPLAY_ROLES.find((r) => r.roleId === conversation.roleId);
  const canEnd = conversation.turnCount >= MIN_TURNS;
  const atMax = conversation.turnCount >= MAX_TURNS;

  return (
    <div className="h-dvh flex flex-col max-w-[375px] mx-auto overflow-hidden" style={{ backgroundColor: '#f8f9ff' }}>
      {/* #10 Header 固定顶部（微信风格） */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 z-10" style={{ backgroundColor: 'rgba(248,249,255,0.95)', backdropFilter: 'blur(6px)', borderBottom: '1px solid #d9e3f4' }}>
        <button type="button" onClick={handleBackToRoles}>
          <ArrowLeft className="w-5 h-5" style={{ color: '#4a4455' }} />
        </button>
        {roleInfo?.avatarText ? (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
            style={{ backgroundColor: roleInfo.avatarColor ?? '#2B8AEF' }}
          >
            {roleInfo.avatarText}
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs" style={{ backgroundColor: '#E8F4FF', color: '#2B8AEF' }}>
            {roleInfo?.displayName[0]}
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: '#121c28' }}>{roleInfo?.displayName}</p>
          <p className="text-[10px]" style={{ color: '#7b7487' }}>
            {conversation.turnCount}/{MAX_TURNS} 轮
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowProfile((v) => !v)}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: '#E8F4FF', color: '#7b7487' }}
          title="角色介绍"
        >
          <Info className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleEnd}
          disabled={!canEnd || ending}
          className="text-xs px-3 py-1.5 rounded-full transition-colors"
          style={
            canEnd
              ? { backgroundColor: 'rgba(43,138,239,0.12)', color: '#2B8AEF' }
              : { backgroundColor: '#E8F4FF', color: '#7b7487', cursor: 'not-allowed' }
          }
        >
          {ending ? COPY.loading.ending : COPY.btn.goToHatch}
        </button>
      </div>

      {/* 消息列表（含角色介绍 + 语气提醒，可滚动） */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {/* #7 角色介绍便签（可展开/收起，在滚动区内） */}
        <AnimatePresence>
          {showProfile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-0 py-2 mb-2"
            >
              <div className="px-4 py-3 rounded-2xl border" style={{ backgroundColor: 'rgba(43,138,239,0.06)', borderColor: 'rgba(43,138,239,0.15)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: '#2B8AEF' }}>
                  {roleInfo?.displayName} · {ROLE_RELATIONSHIP[conversation.roleId]}
                </p>
                {(() => {
                  const profile = agentProfiles?.agentProfiles?.[conversation.roleId];
                  if (!profile) {
                    return (
                      <p className="text-sm leading-relaxed" style={{ color: '#7b7487' }}>
                        TA 的性格是根据你的个人信息和人格画像个性化生成的，聊起来吧。
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      <p className="text-sm leading-relaxed" style={{ color: '#121c28' }}>{profile.personality}</p>
                      {profile.sharedContext && (
                        <p className="text-xs leading-relaxed" style={{ color: '#7b7487' }}>
                          <span style={{ color: '#2B8AEF' }}>你们的交集：</span>
                          {profile.sharedContext}
                        </p>
                      )}
                      {profile.topicAffinity?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {profile.topicAffinity.map((topic) => (
                            <span
                              key={topic}
                              className="text-[10px] px-2 py-0.5 rounded-full border"
                              style={{ backgroundColor: 'rgba(43,138,239,0.08)', color: '#2B8AEF', borderColor: 'rgba(43,138,239,0.15)' }}
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* #8 语气提醒横幅（在滚动区内） */}
        <ToneReminder roleId={conversation.roleId} />

        {(() => {
          // user 消息永远立即显示；assistant 消息仅当不在 pendingDisplayIds 中时显示
          // C3 修复：从 conversation.pendingDisplayIds 读取（替代原独立 state pendingMsgIds）
          const visibleMessages = conversation.messages.filter(
            (msg) => msg.role === 'user' || !conversation.pendingDisplayIds.has(msg.id),
          );
          return visibleMessages.map((msg, idx) => {
            const prevMsg = idx > 0 ? visibleMessages[idx - 1] : undefined;
            const isConsecutiveAssistant =
              msg.role === 'assistant' && prevMsg?.role === 'assistant';
            return (
              <div key={msg.id} className={isConsecutiveAssistant ? 'mt-1' : ''}>
                <ChatBubble
                  role={msg.role}
                  text={msg.segments.slice(0, msg.displayedSegments).join('\n')}
                  avatarText={roleInfo?.avatarText}
                  avatarColor={roleInfo?.avatarColor}
                />
              </div>
            );
          });
        })()}
        {(isTyping || conversation.pendingDisplayIds.size > 0) && <TypingIndicator />}
        <div ref={chatEndRef} />
      </div>

      {/* #9 输入区（apiPending 不阻塞输入框，只阻塞发送按钮） */}
      <div className="shrink-0 px-4 py-3" style={{ backgroundColor: 'rgba(248,249,255,0.95)', backdropFilter: 'blur(6px)', borderTop: '1px solid #d9e3f4' }}>
        {atMax ? (
          <p className="text-xs text-center" style={{ color: '#7b7487' }}>
            已达 {MAX_TURNS} 轮上限，请点击上方"可以结束了"
          </p>
        ) : (
          <div className="flex gap-2">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="说点什么……"
              rows={1}
              disabled={atMax}
              className="flex-1 border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none disabled:opacity-50"
              style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4', color: '#121c28' }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() || atMax}
              className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40 shrink-0"
              style={{ backgroundColor: 'rgba(43,138,239,0.12)', color: '#2B8AEF' }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** #8 语气提醒横幅组件 */
function ToneReminder({ roleId }: { roleId: RoleId }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1 mb-2 px-4 py-2.5 rounded-xl border"
      style={{ backgroundColor: 'rgba(43,138,239,0.06)', borderColor: 'rgba(43,138,239,0.15)' }}
    >
      <p className="text-xs leading-relaxed" style={{ color: '#2B8AEF' }}>
        {ROLE_TONE_HINT[roleId]}
      </p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="text-[10px] mt-1"
        style={{ color: 'rgba(43,138,239,0.5)' }}
      >
        {COPY.btn.gotIt}
      </button>
    </motion.div>
  );
}
