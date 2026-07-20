# Echo 入驻流程三处恢复性 Bug 修复方案（v2）

> **文档目的**：针对注册流程 Phase 0/1/2 的三处恢复性 bug，给出完整的修复方案。
>
> **v2 调整**：基于对根因的进一步分析，**问题不是"localStorage vs 数据库"，而是"前端把 localStorage 当成了权威数据源而非缓存"**。修复策略相应调整为：**先建立后端 GET 查询能力作为基础设施，三个 bug 的修复都复用这套机制**。
>
> **不做改动**：本文档仅为方案评审稿，未对任何代码做修改。

---

## 目录

- [架构判断与修复策略](#架构判断与修复策略)
- [Phase A：后端 GET 查询能力建设（基础设施）](#phase-a后端-get-查询能力建设基础设施)
- [Phase B：Bug ② Phase 2 死循环修复](#phase-bbug--phase-2-死循环修复)
- [Phase C：Bug ③ 消息一次性全发 + 气泡数字错误](#phase-cbug--消息一次性全发--气泡数字错误)
- [Phase D：Bug ① Phase 0/1 字段不恢复](#phase-dbug--phase-01-字段不恢复)
- [实施顺序与依赖](#实施顺序与依赖)
- [风险与回滚](#风险与回滚)

---

## 架构判断与修复策略

### 根因再分析

把三个 bug 简单归因为"localStorage vs 数据库"会掩盖真正的病灶。逐个看：

| Bug | localStorage 是根因？ | 真正的根因 |
|---|---|---|
| ① Phase 0/1 字段不恢复 | ✅ 是 | 前端把 localStorage 当权威源 + 后端没有 GET 查询端点 |
| ② Phase 2 死循环 | ⚠️ 部分是 | localStorage 优先 + **API 设计缺陷**（startChat 不返回状态）+ **错误处理不完整**（400 不解析错误码）|
| ③ 消息一次性全发 | ❌ 不是 | React state 设计问题——messages 数组和 pendingMsgIds Set 分离，localStorage 只是放大器 |

**深层架构病灶**：
- 后端 `onboarding.controller.ts` 所有端点都是 POST，**没有任何 GET 查询端点**
- 前端只能"提交→忘记"，不能"查询→恢复"
- localStorage 被迫承担"权威源"角色，但它的语义只应该是"缓存"

### 修复策略（v2）

```
┌─────────────────────────────────────────────────┐
│  Phase A：后端 GET 查询能力建设（基础设施）       │
│  - GET /onboarding/progress                      │
│  - GET /onboarding/roleplay/chats                │
│  - startChat 改造为返回状态                       │
└─────────────────────────────────────────────────┘
                       ↓
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌──────────────┐               ┌──────────────┐
│  Phase B     │               │  Phase D     │
│  Bug ② 修复  │               │  Bug ① 修复  │
│  (复用 A)    │               │  (复用 A)    │
└──────────────┘               └──────────────┘
       ↓
┌──────────────┐
│  Phase C     │
│  Bug ③ 修复  │
│  (依赖 B)    │
└──────────────┘
```

**核心原则**：
1. **后端是权威源**：所有状态判断以后端为准
2. **localStorage 是缓存**：用于提升首屏体感、离线兜底，但 mount 时以后端 fetch 结果覆盖
3. **GET 早于 POST**：前端 mount 时先 GET 拿权威状态，再决定是否需要 POST 提交

---

## Phase A：后端 GET 查询能力建设（基础设施）

### 目标

为入驻流程建立"前后端状态同步"的基础设施，让后续 Bug ②/① 的修复能复用。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `services/api/src/onboarding/onboarding.controller.ts` | 新增 2 个 GET 端点 |
| `services/api/src/onboarding/onboarding.service.ts` | 新增 `getProgress()` 方法 |
| `services/api/src/onboarding/roleplay-agent.service.ts` | 新增 `listChats()` + 改造 `startChat()` 返回类型 |
| `Echo/src/features/onboarding/v2/onboarding-v2.api.ts` | 新增 `getOnboardingProgress()` + `listRoleplayChats()` + 扩展 `RoleplayStartResponse` |
| `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx` | mount 时调 `listRoleplayChats` 同步 completedRoles |
| `Echo/src/features/onboarding/v2/OnboardingShell.tsx` | mount 时调 `getOnboardingProgress` 拿权威 phase |

### A1. 新增 `GET /onboarding/progress`

**后端 controller**：
```typescript
@Get('progress')
async getProgress(@CurrentUser() userId: string) {
  return this.onboarding.getProgress(userId);
}
```

**后端 service**：
```typescript
async getProgress(userId: string) {
  const session = await this.prisma.onboardingSession.findFirst({
    where: { userId, completed: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!session) {
    return { hasActiveSession: false };
  }

  const survey = (session.surveyJson as OnboardingSurveyJson) ?? {};

  // 从 surveyJson 字段存在性推断当前 phase（向后兼容）
  let inferredPhase: OnboardingPhase = 'phase0';
  if (survey.roleplayChats?.some(c => c.endedAt > 0)) {
    inferredPhase = 'finalize';
  } else if (survey.roleplayChats?.length > 0 || survey.agentProfiles) {
    inferredPhase = 'phase2';
  } else if (survey.idealPartnerSketch) {
    inferredPhase = 'phase1_6';
  } else if (survey.personaSketch) {
    inferredPhase = 'phase1_5';
  } else if (survey.scenarioCards?.length > 0 || survey.identity) {
    inferredPhase = 'phase1';
  }

  return {
    hasActiveSession: true,
    sessionId: session.id,
    currentPhase: inferredPhase,
    phase0Data: survey.identity ?? null,
    phase1Responses: survey.scenarioCards ?? [],
    phase2CompletedRoles: (survey.roleplayChats ?? [])
      .filter(c => c.endedAt > 0)
      .map(c => c.roleName as RoleId),
  };
}
```

**前端 API 函数**：
```typescript
export interface OnboardingProgress {
  hasActiveSession: boolean;
  sessionId?: string;
  currentPhase?: OnboardingPhase;
  phase0Data?: Phase0Payload | null;
  phase1Responses?: Phase1CardResponse[];
  phase2CompletedRoles?: RoleId[];
}

export async function getOnboardingProgress(): Promise<OnboardingProgress> {
  const res = await apiGetJson<OnboardingProgress>('/onboarding/progress');
  return res.ok ? res.data : { hasActiveSession: false };
}
```

> **注**：`apiGetJson` 已存在（`Echo/src/api/client.ts:188`），无需新增工具函数。

### A2. 新增 `GET /onboarding/roleplay/chats`

**后端 controller**：
```typescript
@Get('roleplay/chats')
async listRoleplayChats(@CurrentUser() userId: string) {
  return this.roleplayAgent.listChats(userId);
}
```

**后端 service**：
```typescript
async listChats(userId: string): Promise<{
  chats: Array<{
    chatId: string;
    roleName: RoleName;
    agentName: string;
    status: 'active' | 'ended';
    messageCount: number;
    startedAt: number;
    endedAt: number;
    endedReason?: 'manual' | 'auto_farewell';
  }>;
}> {
  const { session, survey } = await this.getActiveSession(userId);
  const chats = survey.roleplayChats ?? [];
  return {
    chats: chats.map(c => ({
      chatId: (c as any).chatId,
      roleName: c.roleName,
      agentName: c.agentName,
      status: c.endedAt > 0 ? 'ended' : 'active',
      messageCount: c.messages.length,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      endedReason: c.endedAt > 0
        ? (c.qualityFlag === 'incomplete' ? 'auto_farewell' : 'manual')
        : undefined,
    })),
  };
}
```

**前端 API 函数**：
```typescript
export interface RoleplayChatSummary {
  chatId: string;
  roleName: RoleId;
  agentName: string;
  status: 'active' | 'ended';
  messageCount: number;
  startedAt: number;
  endedAt: number;
  endedReason?: 'manual' | 'auto_farewell';
}

export async function listRoleplayChats(): Promise<RoleplayChatSummary[]> {
  const res = await apiGetJson<{ chats: RoleplayChatSummary[] }>('/onboarding/roleplay/chats');
  return res.ok ? res.data.chats : [];
}
```

### A3. 改造 `startChat` 返回类型

**后端 service**（`roleplay-agent.service.ts:103-162`）：

```typescript
interface StartChatResponse {
  chatId: string;
  openingMessage: string;
  agentName: string;
  /** chat 当前状态 */
  status: 'active' | 'ended';
  /** 当 status='ended' 时返回历史消息，让前端可展示 */
  existingMessages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  /** 当 status='ended' 时返回结束原因 */
  endedReason?: 'manual' | 'auto_farewell';
}

async startChat(userId, roleName): Promise<StartChatResponse> {
  // ... 现有逻辑
  const existingChat = this.findChatByRole(survey, roleName);
  if (existingChat) {
    if (!existingChat.endedAt) {
      // 情况 1：未结束 → 复用（现状 + 新增 status 字段）
      return {
        chatId, openingMessage, agentName,
        status: 'active',
      };
    }
    // 情况 2：已结束 → 返回 ended 状态 + 历史消息 + 原因（不自动新建）
    return {
      chatId,
      openingMessage: existingChat.messages[0]?.content ?? role.openingMessage,
      agentName: role.agentName,
      status: 'ended',
      existingMessages: existingChat.messages,
      endedReason: existingChat.qualityFlag === 'incomplete' ? 'auto_farewell' : 'manual',
    };
  }
  // 情况 3：不存在 → 新建（现状 + 新增 status 字段）
  return { chatId, openingMessage, agentName, status: 'active' };
}
```

**前端类型扩展**：
```typescript
export interface RoleplayStartResponse {
  chatId: string;
  openingMessage: string;
  agentName: string;
  status: 'active' | 'ended';        // 新增
  existingMessages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;  // 新增
  endedReason?: 'manual' | 'auto_farewell';  // 新增
}
```

### Phase A 实现后的效果

| 能力 | 修复前 | 修复后 |
|---|---|---|
| 前端查询入驻整体进度 | ❌ 没有 | ✅ GET /onboarding/progress |
| 前端查询角色对话状态 | ❌ 没有 | ✅ GET /onboarding/roleplay/chats |
| 前端启动对话时知道 chat 是否 ended | ❌ 不知道 | ✅ startChat 返回 status |
| 跨设备恢复入驻进度 | ❌ 不可能 | ✅ mount 时调 progress 端点 |

---

## Phase B：Bug ② Phase 2 死循环修复

### 复用 Phase A 的能力

- `GET /onboarding/roleplay/chats` → Phase2Roleplay mount 时拉 completedRoles
- `startChat` 返回 `status` → handleSelectRole 据此决定是否进入对话
- `chatTurn` 400 错误信息 → handleSend 解析"对话已结束"

### 涉及文件

| 文件 | 改动 |
|---|---|
| `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx` | `handleSelectRole` / `handleSend` / `handleEnd` 三处 + mount useEffect 调 `listRoleplayChats` |

### B1. Phase2Roleplay mount 时同步 completedRoles

```typescript
useEffect(() => {
  listRoleplayChats().then((chats) => {
    const completedFromBackend = chats
      .filter(c => c.status === 'ended')
      .map(c => c.roleName as RoleId);
    // 与 localStorage 的 completedRoles 合并（以后端为准）
    setCompletedRoles(completedFromBackend);
    // 同步到 localStorage
    if (userId) saveCompletedRoles(userId, completedFromBackend);
  }).catch(() => {/* 静默失败，降级到 localStorage */});
}, [userId]);
```

### B2. `handleSelectRole` 始终走后端（移除 localStorage 优先分支）

```typescript
const handleSelectRole = async (roleId: RoleId) => {
  setSelectedRole(roleId);
  setError(null);
  clearAllTimers();
  setIsTyping(false);
  setPendingMsgIds(new Set());
  setApiPending(false);
  setInputText('');
  setUnreadCount((prev) => { /* 清未读，保留现状 */ });

  // 关键改动：始终调 startRoleplay，不再 loadConversation 优先
  try {
    const result = await startRoleplay(roleId);
    if (!result) {
      setError('无法开始对话，请重试');
      setSelectedRole(null);
      return;
    }

    // 后端报告对话已结束 → 自动标记完成，停留角色屏
    if (result.status === 'ended') {
      setCompletedRoles((prev) =>
        prev.includes(roleId) ? prev : [...prev, roleId]
      );
      removeConversation(userId, roleId);
      setError('这个角色已经聊过了，去和其他角色聊聊吧');
      setSelectedRole(null);
      return;
    }

    // active 状态 → 用后端返回的 chatId 初始化（不再读 localStorage 的 messages）
    const newConv: RoleplayConversation = {
      roleId,
      chatId: result.chatId,
      messages: [{
        id: 'init-0',
        role: 'assistant',
        segments: [result.openingMessage],
        displayedSegments: 1,
        timestamp: Date.now(),
      }],
      turnCount: 0,
      status: 'active',
    };
    setConversation(newConv);
    saveConversation(userId, newConv);
    setUnreadCount((prev) => ({ ...prev, [roleId]: 1 }));
  } catch (e) {
    setError(e instanceof Error ? e.message : '无法开始对话，请重试');
    setSelectedRole(null);
  }
};
```

### B3. `handleSend` 在 `ended` 和 400 两分支都更新 completedRoles

```typescript
// 分支 1：data.ended（自然告别自动结束）
if (data.ended || data.replies.length === 0) {
  const roleId = conversation?.roleId ?? targetRoleId;
  if (roleId) {
    setCompletedRoles((prev) =>
      prev.includes(roleId) ? prev : [...prev, roleId]
    );
    removeConversation(userId, roleId);
    setUnreadCount((prev) => {/* 清未读 */});
  }
  if (viewingRoleIdRef.current === targetRoleId) {
    setIsTyping(false);
    setPendingMsgIds(new Set());
    clearAllTimers();
    setConversation(null);
    setSelectedRole(null);
  }
  return;
}

// 分支 2：400 错误（后端报告对话已结束）
if (!res.ok) {
  const errorMsg = res.message ?? '';
  const isChatEnded = errorMsg.includes('对话已结束');

  if (isChatEnded && targetRoleId) {
    setCompletedRoles((prev) =>
      prev.includes(targetRoleId) ? prev : [...prev, targetRoleId]
    );
    removeConversation(userId, targetRoleId);
    setUnreadCount((prev) => {/* 清未读 */});
  }

  if (viewingRoleIdRef.current === targetRoleId) {
    setIsTyping(false);
    setPendingMsgIds(new Set());
    clearAllTimers();
    setConversation(null);
    setSelectedRole(null);
    if (!isChatEnded) setInputText(msgText);  // 仅非"已结束"才回填输入框
  }
  return;
}
```

### B4. `handleEnd` 网络失败容错

```typescript
const handleEnd = async () => {
  if (!conversation || ending) return;
  setEnding(true);
  clearAllTimers();
  setPendingMsgIds(new Set());

  let endSuccess = false;
  try {
    await endRoleplay(conversation.chatId);
    endSuccess = true;
  } catch (e) {
    // 网络失败：仍推进前端，后端 chat 留 active；下次进入会让用户重聊（可接受降级）
    console.warn('[Phase2] endRoleplay failed, proceeding locally:', e);
  }

  removeConversation(userId, conversation.roleId);
  // ... 后续清理逻辑保持不变
};
```

### Phase B 实现后的效果

| 场景 | 修复前 | 修复后 |
|---|---|---|
| 用户和小夜自然告别退出 | 角色屏仍显示"需要聊"，死循环 | 后端自动 ended → mount 时 listRoleplayChats 同步 → crush 已在 completedRoles |
| 用户聊一半按 X 退出整个 onboarding | 下次进入 loadConversation 用旧 chatId → 400 死循环 | 下次进入 startRoleplay 返回 status='active'，正常继续 |
| 用户换设备继续入驻 | 不可能 | mount 时 listRoleplayChats + startRoleplay 拿权威状态 |
| 用户手动结束但网络失败 | 前后端不一致 | 前端推进，后端 chat 留 active，下次进入让用户重聊（降级） |

---

## Phase C：Bug ③ 消息一次性全发 + 气泡数字错误

### 根因

与 localStorage 无关，是 React state 设计问题：
- `messages` 数组在 `setConversation` updater 中一次性加入所有 assistant 消息
- 靠独立的 `pendingMsgIds` Set 控制可见性 + setTimeout 逐个移除
- `handleBackToRoles` 清空 pendingMsgIds 但不清 messages → 跨组件生命周期时 localStorage 放大问题

### 涉及文件

| 文件 | 改动 |
|---|---|
| `Echo/src/features/onboarding/v2/onboarding-v2.types.ts` | `RoleplayConversation` 类型扩展 `pendingDisplayIds: Set<string>` |
| `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx` | 合并 `pendingMsgIds` 到 `conversation` + 持久化 + unmount 补救 + 动画重启 useEffect |

### C1. 类型扩展

```typescript
// onboarding-v2.types.ts
interface RoleplayConversation {
  roleId: RoleId;
  chatId: string;
  messages: ChatMessage[];
  turnCount: number;
  status: 'active';
  pendingDisplayIds: Set<string>;  // 新增：尚未视觉展示的 assistant 消息 ID
}
```

### C2. 持久化结构扩展

```typescript
interface PersistedConversation {
  chatId: string;
  roleId: RoleId;
  messages: ChatMessage[];
  turnCount: number;
  pendingDisplayIds: string[];  // 新增（数组形式便于 JSON 序列化）
}

function saveConversation(userId: string, conv: RoleplayConversation): void {
  try {
    localStorage.setItem(p2Key(userId, conv.roleId), JSON.stringify({
      chatId: conv.chatId,
      roleId: conv.roleId,
      messages: conv.messages,
      turnCount: conv.turnCount,
      pendingDisplayIds: Array.from(conv.pendingDisplayIds),  // 新增
    }));
  } catch { /* silent */ }
}

function loadConversation(userId: string, roleId: RoleId): RoleplayConversation | null {
  try {
    const raw = localStorage.getItem(p2Key(userId, roleId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      pendingDisplayIds: new Set(parsed.pendingDisplayIds ?? []),  // 兼容旧数据
      status: 'active',
    } as RoleplayConversation;
  } catch {
    return null;
  }
}
```

### C3. `pendingMsgIds` state 合并进 `conversation`

```typescript
// 移除独立的 pendingMsgIds state
// const [pendingMsgIds, setPendingMsgIds] = useState<Set<string>>(new Set());

// 所有 setPendingMsgIds(...) 调用改为 setConversation updater：
// 例如：
// 旧：setPendingMsgIds(new Set());
// 新：setConversation(prev => prev ? { ...prev, pendingDisplayIds: new Set() } : prev);

// 旧：setPendingMsgIds((prev) => new Set([...prev, ...newIds]));
// 新：setConversation(prev => prev ? { ...prev, pendingDisplayIds: new Set([...prev.pendingDisplayIds, ...newIds]) } : prev);

// visibleMessages 计算改为读 conversation.pendingDisplayIds
const visibleMessages = conversation.messages.filter(
  (msg) => msg.role === 'user' || !conversation.pendingDisplayIds.has(msg.id),
);
```

> 共约 8 处机械替换，无逻辑变更。

### C4. `handleBackToRoles` 不再清空 pending

```typescript
const handleBackToRoles = () => {
  if (conversation && conversation.pendingDisplayIds.size > 0) {
    // 累加未读（修复覆盖 bug）
    setUnreadCount((prev) => ({
      ...prev,
      [conversation.roleId]: (prev[conversation.roleId] ?? 0) + conversation.pendingDisplayIds.size,
    }));
  }
  clearAllTimers();
  setIsTyping(false);
  // 不再清空 pendingDisplayIds —— 让它随 conversation 一起持久化
  setApiPending(false);
  setConversation(null);
  setSelectedRole(null);
  setInputText('');
};
```

### C5. unmount 补救（处理整体退出 onboarding）

```typescript
useEffect(() => {
  return () => {
    // 组件卸载前把 pending 消息标为未读 + 确保 conversation 已持久化
    if (conversation && conversation.pendingDisplayIds.size > 0) {
      const roleId = conversation.roleId;
      const count = conversation.pendingDisplayIds.size;
      try {
        const raw = localStorage.getItem(`echo_phase2_unread_${userId}`);
        const current = raw ? JSON.parse(raw) : {};
        current[roleId] = (current[roleId] ?? 0) + count;
        localStorage.setItem(`echo_phase2_unread_${userId}`, JSON.stringify(current));
      } catch { /* silent */ }
      saveConversation(userId, conversation);  // 确保 pendingDisplayIds 已保存
    }
    clearAllTimers();
  };
}, [clearAllTimers, conversation, userId]);
```

### C6. 重启动画的 useEffect

```typescript
useEffect(() => {
  if (!conversation || conversation.pendingDisplayIds.size === 0) return;
  if (typingTimersRef.current.length > 0) return;  // 已有动画进行中

  // 重启未展示消息的动画
  const pendingIds = Array.from(conversation.pendingDisplayIds);
  pendingIds.forEach((msgId) => {
    const timer = setTimeout(() => {
      setConversation((prev) => {
        if (!prev) return prev;
        const next = new Set(prev.pendingDisplayIds);
        next.delete(msgId);
        return { ...prev, pendingDisplayIds: next };
      });
      setIsTyping(false);
    }, 800);
    typingTimersRef.current.push(timer);
  });
}, [conversation?.pendingDisplayIds]);
```

### Phase C 实现后的效果

| 场景 | 修复前 | 修复后 |
|---|---|---|
| 用户在小夜对话中 agent 发 3 条消息，第 2 条展示中时退回角色屏 | 3 条全部一次性显示在下次进入时；未读数=3 覆盖之前累计 | 3 条仍处于 pending，下次进入时逐条动画展示；未读数=之前+3 |
| 用户在打字动画中按 X 退出 onboarding | pending 消息丢失，未读数不变 | pending 消息存入 localStorage，未读数累加，下次进入正确恢复 |
| 跨设备 pending 恢复 | 跨设备 pending 丢失 | 同（可接受降级——pending 是 1-2 秒级视觉状态）|

---

## Phase D：Bug ① Phase 0/1 字段不恢复

### 复用 Phase A 的能力

- `GET /onboarding/progress` → OnboardingShell mount 时拿权威 currentPhase + 各 phase 字段
- Phase A 已经返回 `phase0Data` / `phase1Responses`，前端直接用

### 涉及文件

| 文件 | 改动 |
|---|---|
| `Echo/src/features/onboarding/v2/OnboardingShell.tsx` | mount 时调 `getOnboardingProgress` 优先恢复 |
| `Echo/src/features/onboarding/v2/Phase0Identity.tsx` | mount 时读 localStorage 缓存 + 增加 checkpoint |
| `Echo/src/features/onboarding/v2/Phase1Cards.tsx` | mount 时优先读后端缓存的 responses |

### D1. OnboardingShell mount 时优先调 GET /progress

```typescript
useEffect(() => {
  (async () => {
    try {
      const progress = await getOnboardingProgress();
      if (progress.hasActiveSession && progress.currentPhase) {
        // 后端有 active session → 用后端的 phase
        const targetIdx = PHASE_ORDER.indexOf(progress.currentPhase);
        const completedPhases = PHASE_ORDER.slice(0, targetIdx);
        const newSession: OnboardingSession = {
          phase: progress.currentPhase,
          completedPhases,
          savedAt: new Date().toISOString(),
        };
        save(newSession);
        setPhase(progress.currentPhase);

        // 把后端的字段数据缓存到 localStorage（让 Phase0Identity / Phase1Cards 能读）
        if (progress.phase0Data) {
          localStorage.setItem(
            `onboarding_phase0_formdata_${userId}`,
            JSON.stringify(progress.phase0Data),
          );
        }
        if (progress.phase1Responses?.length > 0) {
          localStorage.setItem(
            `onboarding_phase1_responses_${userId}`,
            JSON.stringify({ index: 0, responses: progress.phase1Responses }),
          );
        }
        setReady(true);
        return;
      }
    } catch (e) {
      console.warn('[OnboardingShell] getProgress failed, fallback to localStorage:', e);
    }
    // 降级：原有 localStorage 恢复
    await restore();
    setReady(true);
  })();
}, [restore, save, userId]);
```

### D2. Phase 0 加 localStorage checkpoint

```typescript
// Phase0Identity.tsx
const STORAGE_KEY = `onboarding_phase0_formdata_${userId}`;

const [formData, setFormData] = useState<Partial<Phase0Payload>>(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
});

useEffect(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  } catch { /* silent */ }
}, [formData]);

const handleSubmit = async () => {
  // ... 现有提交逻辑
  if (success) {
    localStorage.removeItem(STORAGE_KEY);  // 提交成功后清理
  }
};
```

### D3. Phase 1 mount 时优先读后端缓存的 responses

```typescript
// Phase1Cards.tsx（已有 localStorage 恢复逻辑，无需大改）
// OnboardingShell 在 D1 中已经把 progress.phase1Responses 写入了 localStorage
// Phase1Cards mount 时读 localStorage 自然就能拿到后端数据
// 唯一调整：把 checkpoint 频率从"每 5 卡"加密到"每卡"（更细粒度）
const saveCheckpoint = useCallback((idx: number, resps: Phase1CardResponse[]) => {
  localStorage.setItem(localStorageKey, JSON.stringify({ index: idx, responses: resps }));
}, []);
```

### Phase D 实现后的效果

| 场景 | 修复前 | 修复后 |
|---|---|---|
| 同设备 Phase 0 中途退出 | 全部重填 12 个字段 | 自动恢复 |
| 同设备 Phase 1 中途退出 | 5 卡内丢失 | 每卡都保存，无丢失 |
| 跨设备继续入驻 | 从 phase0 重头 | 后端有 active session → 跳到对应 phase + 字段恢复 |
| 清缓存后继续入驻 | 从 phase0 重头 | 后端有 active session → 跳到对应 phase + 字段恢复 |
| OnboardingSession 已完成（completed=true） | 不影响 | `hasActiveSession: false` → 走原有流程从 phase0 开始 |

---

## 实施顺序与依赖

```
Phase A（基础设施，P0）
  ├── A1: GET /onboarding/progress
  ├── A2: GET /onboarding/roleplay/chats
  └── A3: startChat 返回 status
         ↓
    ┌────┴────┐
    ▼         ▼
Phase B     Phase D
(Bug ②)    (Bug ①)
P0         P2
    │
    ▼
Phase C
(Bug ③)
P1
```

**建议**：
- **第一周**：Phase A（基础设施）+ Phase B（Bug ② 死循环）一起做。Bug ② 是阻断性的，必须先修；Phase A 是 Phase B 的前置依赖，自然一起。
- **第二周**：Phase C（Bug ③ 体验问题）+ Phase D（Bug ① 字段恢复）。这两个独立，可并行。

### 工期估算

| Phase | 工期 | 改动文件数 |
|---|---|---|
| Phase A | 1-1.5 天 | 4（后端 controller/service + 前端 API client + 类型）|
| Phase B | 0.5-1 天 | 1（Phase2Roleplay.tsx）|
| Phase C | 0.5-1 天 | 2（types + Phase2Roleplay.tsx）|
| Phase D | 0.5 天 | 3（OnboardingShell + Phase0Identity + Phase1Cards 微调）|
| **合计** | **2.5-4 天** | **6 个文件**（有重叠）|

---

## 风险与回滚

### 共性风险

1. **Phase A 是基础设施改造**：影响所有 onboarding 路径，需充分测试。
   - **回滚**：后端新增的 GET 端点用 feature flag `ONBOARDING_GET_API_ENABLED=true` 控制，关闭后前端降级到 localStorage。

2. **Phase B `handleSelectRole` 移除 localStorage 优先分支**：每次进入角色都调 startRoleplay，增加后端压力。
   - **权衡**：startRoleplay 本身是幂等的（已存在 chat 会复用），不会创建重复 chat；压力可接受。
   - **优化**：可以加 5 秒内的内存缓存，避免短时间内反复点同一角色。

3. **Phase C `pendingMsgIds` 合并进 `conversation`**：较大重构（约 8 处机械替换）。
   - **回滚**：git revert 即可，不影响后端。
   - **兼容性**：`loadConversation` 用 `parsed.pendingDisplayIds ?? []` 兜底旧数据。

4. **Phase D `currentPhase` 用推断逻辑**：边界场景可能不准（如 phase1_5 调整 sketch 时退出 → 推断成 phase1_6）。
   - **缓解**：先用推断逻辑上线；后续可在 `OnboardingSession` 表新增 `currentPhase String?` 字段做权威值（需迁移）。
   - **降级**：即使推断错了，用户跳到下一个 phase 也能正常推进，不会卡死。

### 回滚预案

| 修复项 | 回滚方式 |
|---|---|
| Phase A | 关闭 feature flag `ONBOARDING_GET_API_ENABLED`，前端降级到 localStorage |
| Phase B | `handleSelectRole` 恢复 loadConversation 优先分支（git revert）|
| Phase C | `pendingDisplayIds` 字段忽略，`handleBackToRoles` 恢复清空逻辑（git revert）|
| Phase D | OnboardingShell mount 时不调 getProgress，恢复原 localStorage 恢复（git revert）|

### 验证清单

每个 Phase 上线前必须验证：

**Phase A 验证**：
- [ ] `curl http://localhost:4000/v1/onboarding/progress` 返回正确结构
- [ ] `curl http://localhost:4000/v1/onboarding/roleplay/chats` 返回正确状态
- [ ] `startRoleplay` 返回 `status: 'active'` / `'ended'`
- [ ] 后端 `cd services/api && npm run lint` 退出码 0

**Phase B 验证**：
- [ ] 4 个角色每个完成 1 次自然告别（auto-ended）→ completedRoles 自动更新
- [ ] 4 个角色每个完成 1 次手动结束 → completedRoles 正常
- [ ] 中途退出 onboarding 重新进入 → startRoleplay 返回 active 状态正常继续
- [ ] 换设备继续入驻 → listRoleplayChats 拉到正确 completedRoles

**Phase C 验证**：
- [ ] 在打字动画中退回角色屏 → 下次进入逐条动画展示
- [ ] 在打字动画中按 X 退出 onboarding → 未读数累加，下次进入正确恢复
- [ ] 跨角色切换无串台
- [ ] 前端 `npm --prefix Echo run lint` 退出码 0

**Phase D 验证**：
- [ ] Phase 0 中途退出 → 同设备自动恢复
- [ ] Phase 1 中途退出 → 同设备无丢失
- [ ] 清缓存后重新进入 → 跳到对应 phase + 字段恢复
- [ ] OnboardingSession 完成态（completed=true）→ 走原有流程从 phase0 开始

---

## 附：v1 vs v2 方案对比

| 维度 | v1 方案 | v2 方案 |
|---|---|---|
| 实施顺序 | Bug ② → ③ → ①一期 → ①二期 | Phase A → B+C → D |
| 后端 GET 端点 | Bug ① 二期才加（P3） | Phase A 先加（P0 基础设施） |
| Bug ② 修复方式 | 临时扩展 startChat 返回类型 | 复用 Phase A 的 GET /roleplay/chats + startChat 返回 status |
| Bug ① 分期 | 一期（localStorage）+ 二期（GET 端点） | 不分期，直接做完整方案 |
| 总工期 | 4-6 天（分 4 期） | 2.5-4 天（4 个 Phase 并行度高）|
| 架构改善 | 局部修补 | 建立"前后端状态同步"基础设施 |
| 跨设备恢复 | 二期才支持 | Phase A 上线即支持 |

**v2 的核心优势**：把"建立后端 GET 查询能力"前置为基础设施，让三个 bug 的修复都复用，避免 v1 中"先打补丁再重构"的重复工作。
