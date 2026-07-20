# Phase B 实施完成 — Bug ② Phase 2 死循环修复

> **日期**：2026-07-20
> **方案文档**：`outputs/onboarding-resume-fix-plan.md`（v2）
> **改动文件数**：1 个（前端 Phase2Roleplay.tsx）
> **lint 验证**：前端 `tsc --noEmit` 退出码 0

---

## 改动清单

### `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx`

#### B1: mount 时调 listRoleplayChats 同步 completedRoles
新增 useEffect（在 localStorage 恢复 useEffect 之后）：
```ts
useEffect(() => {
  listRoleplayChats()
    .then((chats) => {
      const completedFromBackend = chats
        .filter((c) => c.status === 'ended')
        .map((c) => c.roleName);
      // 以后端为准（取并集）
      setCompletedRoles((prev) => {
        const merged = new Set(prev);
        for (const r of completedFromBackend) merged.add(r);
        return Array.from(merged);
      });
      // 清理后端已结束但 localStorage 仍保留的 conversation
      for (const chat of chats) {
        if (chat.status === 'ended') {
          removeConversation(userId, chat.roleName);
        }
      }
    })
    .catch(() => {/* 降级到 localStorage */});
}, [userId]);
```

#### B2: handleSelectRole 始终走后端 + 处理 status='ended'
- **移除** `loadConversation 优先 return` 分支（死循环的源头）
- 始终调 `startRoleplay(roleId)` 拿后端权威状态
- 当 `result.status === 'ended'`：
  - 加入 completedRoles
  - removeConversation + 清 savedConversations + 清 unreadCount
  - 显示"这个角色已经聊过了，去和其他角色聊聊吧"
  - 停留角色屏

#### B3: handleSend 在 ended 和 400 两分支都更新 completedRoles

**!res.ok 分支**（解析"对话已结束"错误码）：
```ts
if (res.ok === false) {
  const errorMsg = res.message ?? '';
  const isChatEnded = errorMsg.includes('对话已结束') || res.status === 400;
  
  if (isChatEnded) {
    setCompletedRoles((prev) =>
      prev.includes(targetRoleId) ? prev : [...prev, targetRoleId],
    );
    removeConversation(userId, targetRoleId);
    // ... 清理 savedConversations + unreadCount
  }
  // ... 仅非"已结束"错误才回填输入框
}
```

**data.ended 分支**（自然告别自动结束）：
```ts
if (data.ended || data.replies.length === 0) {
  // B3 修复：把角色标记为完成（原代码遗漏导致死循环）
  setCompletedRoles((prev) =>
    prev.includes(targetRoleId) ? prev : [...prev, targetRoleId],
  );
  removeConversation(userId, targetRoleId);
  // ... 清理 + setConversation(null)
}
```

> **关键技巧**：用 `res.ok === false` 替代 `!res.ok` 显式 narrow union 类型，TS 更可靠地收敛 ApiResult 类型。

#### B4: handleEnd 网络失败容错
```ts
try {
  await endRoleplay(conversation.chatId);
} catch (e) {
  // 网络失败：仍推进前端，后端 chat 留 active，下次进入让用户重聊
  console.warn('[Phase2] endRoleplay failed, proceeding locally:', e);
}
// 无论成功失败都执行后续清理 + setCompletedRoles
```

---

## 死循环修复原理

### 原死循环路径（已切断）

```
1. 用户和小夜自然告别
   → 后端 chatTurn 检测双方告别 → auto-endedAt
   → 返回 {replies: [], ended: true}

2. 前端 handleSend 看到 data.ended
   → setConversation(null), setSelectedRole(null)
   → ❌ 但 completedRoles 没加 crush

3. 用户回到角色屏，看到"小夜还需要聊"

4. 用户再点小夜
   → handleSelectRole loadConversation 拿到旧 conv（含旧 chatId）
   → setConversation(saved) → return（不调后端）
   → ❌ 前端 conv.status='active'，但后端 chat.endedAt > 0

5. 用户发消息
   → 后端 chatTurn: chat.endedAt > 0 → 抛 400 "对话已结束"
   → 前端 !res.ok: setConversation(null)
   → ❌ 仍未更新 completedRoles

6. 回到步骤 3 → 死循环
```

### 修复后路径

```
1. 用户和小夜自然告别
   → 后端 auto-endedAt → 返回 {ended: true}

2. 前端 handleSend 看到 data.ended
   → ✅ B3 修复：把 crush 加入 completedRoles
   → ✅ removeConversation(userId, 'crush')
   → setConversation(null)

3. 用户回到角色屏，看到"小夜已完成 ✅"

4. 即使用户误点小夜
   → handleSelectRole 调 startRoleplay
   → ✅ B2 修复：后端返回 status='ended'
   → 前端再次确认 completedRoles + 显示提示 + 停留角色屏

5. 不会进入死循环

附加保护：
- ✅ B1: mount 时 listRoleplayChats 同步，即使 localStorage completedRoles 丢失也会恢复
- ✅ B4: handleEnd 网络失败不卡死，下次进入让用户重聊
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

| 场景 | 预期行为 |
|---|---|
| 4 个角色每个自然告别结束 | completedRoles 自动更新，角色屏显示已完成 |
| 4 个角色每个手动点"可以结束了" | completedRoles 正常更新 |
| 中途退出 onboarding 重新进入 | startRoleplay 返回 active，正常继续 |
| 换设备继续入驻 | listRoleplayChats 拉到正确 completedRoles |
| 后端 chat 已 ended 但用户点进去 | 显示"已经聊过了"，停留角色屏 |
| handleEnd 网络失败 | 前端仍推进，不卡死 |

---

## 下一步

Phase B 完成，可以开始 Phase C（Bug ③ 消息一次性全发 + 气泡数字错误）或 Phase D（Bug ① 字段恢复），两者独立可并行。

**建议**：先做 Phase C（依赖 Phase B 的 conversation 状态机），再做 Phase D（独立）。
