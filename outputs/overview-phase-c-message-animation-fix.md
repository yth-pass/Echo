# Phase C 实施完成 — Bug ③ 消息一次性全发 + 气泡数字错误

> **日期**：2026-07-20
> **方案文档**：`outputs/onboarding-resume-fix-plan.md`（v2）
> **改动文件数**：2 个
> **lint 验证**：前端 `tsc --noEmit` 退出码 0

---

## 改动清单

### 1. `Echo/src/features/onboarding/v2/onboarding-v2.types.ts`
- `RoleplayConversation` 新增 `pendingDisplayIds: Set<string>` 字段
- 把"消息存在性"（messages）和"消息可见性"（pendingDisplayIds）绑定在同一个对象上

### 2. `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx`

#### C1: 类型扩展
```ts
interface RoleplayConversation {
  // ... 原有字段
  pendingDisplayIds: Set<string>;  // 新增
}
```

#### C2: 持久化扩展
- `saveConversation`: 序列化 `pendingDisplayIds` 为数组
- `loadConversation`: 反序列化时还原为 Set，**兼容旧数据**（无字段时返回空 Set）

#### C3: pendingMsgIds 合并进 conversation
- 移除独立的 `const [pendingMsgIds, setPendingMsgIds] = useState<Set<string>>(new Set())`
- 新增 `setPendingDisplayIds` 辅助函数（通过 setConversation updater 更新）
- 约 10 处机械替换：所有 `setPendingMsgIds(...)` 改为 `setPendingDisplayIds(...)` 或直接 `setConversation(null)` 自动清空
- `visibleMessages` 计算改为读 `conversation.pendingDisplayIds`
- `TypingIndicator` 显示条件改为 `conversation.pendingDisplayIds.size > 0`

#### C4: handleBackToRoles 不清 pending + 未读累加
```ts
// 原代码：覆盖（丢失之前累计）
setUnreadCount((prev) => ({ ...prev, [roleId]: pendingMsgIds.size }));
setPendingMsgIds(new Set());

// 修复后：累加 + 不清 pending（让它随 conversation 持久化）
setUnreadCount((prev) => ({ ...prev, [roleId]: (prev[roleId] ?? 0) + pendingCount }));
saveConversation(userId, conversation);  // 确保 pendingDisplayIds 已保存
```

#### C5: unmount 补救
```ts
useEffect(() => {
  return () => {
    if (conversation && conversation.pendingDisplayIds.size > 0) {
      saveConversation(userId, conversation);  // 持久化 pendingDisplayIds
      // 直接写 localStorage 累加未读（setState 在 unmount 后不生效）
      const raw = localStorage.getItem(`echo_phase2_unread_${userId}`);
      const current = raw ? JSON.parse(raw) : {};
      current[roleId] = (current[roleId] ?? 0) + count;
      localStorage.setItem(`echo_phase2_unread_${userId}`, JSON.stringify(current));
    }
    clearAllTimers();
  };
}, [clearAllTimers, conversation, userId]);
```

#### C6: 重启动画 useEffect
```ts
useEffect(() => {
  if (!conversation) return;
  if (conversation.pendingDisplayIds.size === 0) return;
  if (typingTimersRef.current.length > 0) return;  // 已有动画进行中
  
  const pendingIds = Array.from(conversation.pendingDisplayIds);
  let cumulativeDelay = 0;
  pendingIds.forEach((msgId) => {
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
  setIsTyping(true);
}, [conversation?.pendingDisplayIds, conversation, setPendingDisplayIds]);
```

---

## 消息一次性全发修复原理

### 原 bug 根因（与 localStorage 无关）

```
1. handleSend 中 setConversation updater 一次性把所有 assistantMsgs 加入 messages
   → messages 数组立即包含全部消息

2. 靠独立 state pendingMsgIds 控制可见性
   → visibleMessages = messages.filter(msg => !pendingMsgIds.has(msg.id))
   → setTimeout 逐个从 pendingMsgIds 移除来"显示"

3. handleBackToRoles 清空 pendingMsgIds（Set([])）
   → 但 messages 已含全部消息
   → conversation 通过 useEffect 持久化到 localStorage（含全部消息）

4. 下次进入 loadConversation 拿到 messages
   → 新组件实例 pendingMsgIds = new Set() 初始为空
   → 所有 assistant 消息全部不在 pending 中 → 全部立即显示
   → 丧失"逐条弹出"的体验
```

### 修复后

```
1. pendingDisplayIds 与 messages 绑定在同一个 conversation 对象上
   → 不再有"双 state 不同步"问题

2. handleBackToRoles 不清空 pendingDisplayIds
   → 让它随 conversation 持久化到 localStorage

3. 下次进入 loadConversation 恢复 pendingDisplayIds
   → C6 useEffect 监听 pendingDisplayIds 变化
   → 自动启动 setTimeout 动画逐个移除
   → 所有消息仍然逐条动画展示
```

---

## 气泡数字错误修复原理

### 原 bug

```ts
// handleBackToRoles 用 = 覆盖（丢失之前累计）
setUnreadCount((prev) => ({ ...prev, [roleId]: pendingMsgIds.size }));

// handleExit 触发 unmount 时不更新 unreadCount
// → pending 消息静默丢失，气泡数字不变（错误）
```

### 修复后

```ts
// handleBackToRoles 改累加
setUnreadCount((prev) => ({ ...prev, [roleId]: (prev[roleId] ?? 0) + pendingCount }));

// unmount 补救：直接写 localStorage 累加未读（React 反模式但必要）
const current = raw ? JSON.parse(raw) : {};
current[roleId] = (current[roleId] ?? 0) + count;
localStorage.setItem(`echo_phase2_unread_${userId}`, JSON.stringify(current));
```

---

## 验证结果

```
前端：npm --prefix Echo run lint
  > tsc --noEmit
  退出码 0 ✅
  (3 个预先存在的 poster 模块错误与本次改动无关)
```

---

## 涉及的场景验证（建议手动测试）

| 场景 | 修复前 | 修复后 |
|---|---|---|
| 在打字动画中退回角色屏 | 下次进入所有消息一次性显示 | 下次进入仍逐条动画展示 |
| 在打字动画中按 X 退出 onboarding | pending 消息丢失，未读数不变 | pending 存入 localStorage，未读数累加，下次进入恢复 |
| 跨角色切换无串台 | 仍有串台风险 | clearAllTimers + pendingDisplayIds 随 conversation 切换 |
| 之前累计未读 + 新 pending | 覆盖（丢失之前累计） | 累加（prev + pending.size） |

---

## 设计决策

1. **`setPendingDisplayIds` 辅助函数**：封装 setConversation updater 模式，让 10 处替换更简洁
2. **conversation 为 null 时 setPendingDisplayIds 无操作**：updater return prev 直接返回 null，符合预期
3. **setConversation(null) 自动清空 pendingDisplayIds**：无需单独清，减少代码重复
4. **C6 useEffect 依赖 `conversation?.pendingDisplayIds`**：Set 引用变化才触发（每次更新都是新 Set 实例）
5. **unmount 时直接写 localStorage 而非 setState**：React 反模式但必要（unmount 后 setState 无效）
6. **兼容旧数据**：`loadConversation` 用 `parsed.pendingDisplayIds ?? []` 兜底，旧 localStorage 数据自动转换为空 Set

---

## 下一步

Phase C 完成，剩下 Phase D（Bug ① Phase 0/1 字段不恢复），改动集中在：
- `OnboardingShell.tsx` — mount 时调 getOnboardingProgress
- `Phase0Identity.tsx` — 加 localStorage checkpoint
- `Phase1Cards.tsx` — 微调（OnboardingShell 已把后端数据缓存到 localStorage）

Phase D 独立于 Phase B/C，预计 0.5 天。
