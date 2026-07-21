# Echo Onboarding 登录恢复 + Phase2 聊天改进报告

> **角色**: Senior Developer (高级开发工程师)
> **日期**: 2026-07-21
> **范围**: 登录后 Onboarding 进度恢复弹窗、Phase 间跳转、Phase2 聊天消息顺序 Bug
> **状态**: 仅审查 + 方案设计，未修改任何代码

---

## 摘要

用户提出两项改进诉求，经代码审查后结论如下：

| # | 诉求 | 审查结论 |
|---|------|---------|
| 1 | 登录后弹窗提示上次进度 + 允许跳回已完成 Phase 修改 | **属实** — 当前完全无弹窗、无跨 Phase 跳转 UI |
| 2 | Phase2 聊天连发 2 条消息时，agent 回复会插在两条用户消息之间 | **属实** — 根因是渲染按"数组 push 顺序"而非"消息可见时间"排序，agent 回复 push 时位置固定在用户后续消息之前，揭示时视觉上插中间 |

关于"不要显示 phase0/phase1 字样"的诉求：当前 UI 实际**并不显示**这些内部代号，但确实缺少统一的"phase 总结性标签"体系（各 phase 组件各自写死零散 h2 标题）。深层诉求合理。

---

## 一、当前现状审查

### 1.1 登录恢复与 Phase 跳转

#### 流程结构（共 6 个 Phase，线性推进）

| Phase | 内部代号 | 组件 | 当前 UI 标题 | 建议总结性标签 |
|-------|---------|------|-------------|---------------|
| 1 | `phase0` | `Phase0Identity` | （无 phase 级标题，仅显示字段名） | **基础信息** |
| 2 | `phase1` | `Phase1Cards` | （无 phase 级标题，仅 ProgressRing X/15） | **个人特征** |
| 3 | `phase1_5` | `Phase1_5Sketch` | "你的人格画像" | **人格画像** |
| 4 | `phase1_6` | `Phase1_6IdealSketch` | "你需要什么样的人？" | **理想型画像** |
| 5 | `phase2` | `Phase2Roleplay` | "和 TA 们聊聊" | **角色对话** |
| 6 | `finalize` | `Finalize` | "分身正在生成" / "你的数字分身，已诞生。" | **分身孵化** |

**关键文件**:
- `Echo/src/features/onboarding/v2/onboarding-v2.types.ts:11-20` — `PHASE_ORDER` 定义
- `Echo/src/features/onboarding/v2/OnboardingShell.tsx` — 状态机主控
- `services/api/src/onboarding/onboarding.service.ts:259-319` — `getProgress` 后端实现

#### 登录恢复机制（前端）

`OnboardingShell.tsx:47-110` mount 时：
1. 调 `GET /onboarding/progress` 拿权威 `currentPhase` + 已存字段数据
2. 把 `phase0Data` / `phase1Responses` / `phase2CompletedRoles` 写回 localStorage 供各 Phase 组件 mount 时回填
3. 失败降级到 localStorage
4. **没有任何弹窗/确认对话框** — 直接静默 `setPhase(session.phase)` 跳转

#### 登录恢复机制（后端）

`onboarding.service.ts:294-307` — 进度字段不独立存储，而是从 `OnboardingSession.surveyJson` 的字段存在性**推断**：

```ts
if (chats.some((c) => c.endedAt > 0)) currentPhase = 'finalize';
else if (chats.length > 0 || survey.agentProfiles) currentPhase = 'phase2';
else if (survey.idealPartnerSketch) currentPhase = 'phase1_6';
else if (survey.personaSketch) currentPhase = 'phase1_5';
else if ((survey.scenarioCards?.length ?? 0) > 0 || survey.identity) currentPhase = 'phase1';
else currentPhase = 'phase0';
```

返回字段：`hasActiveSession` / `sessionId` / `currentPhase` / `phase0Data` / `phase1Responses` / `phase2CompletedRoles`

#### Phase 间跳转能力（关键瓶颈）

`OnboardingShell.tsx:132-176` — 只暴露两个跳转函数：
- `advancePhase(current)` — **只能前进**，把当前 phase 加入 completedPhases，跳到下一个
- `goBackToPhase(target, errorMessage?)` — **仅用于错误回退**，被 `Phase1_5Sketch` / `Phase1_6IdealSketch` / `Finalize` 在后端报"数据不完整"时被动调用

**没有用户主动"回到 phase0 修改"的入口**。各 Phase 组件的"返回"按钮只在 Phase 内部回退（如 Phase1 卡片索引回退），不能跨 Phase。

**后端数据层其实支持回改**：`submitPhase0` / `submitPhase1` 是 upsert，已完成的 phase 数据被保留在 `surveyJson` 中，`getProgress` 会读出供前端回填。**数据层就绪，UI 层缺失**。

#### 用户反馈验证

1. **"无法回头修改已完成的 phase"** — ✅ **属实**
   - 状态机只允许前进 + 错误回退，无用户主动跨 phase 导航
   - 用户在 phase2 想改 phase0/phase1 内容：当前 UI 完全做不到

2. **"不要显示 phase0/phase1 字样"** — ⚠️ **表层不属实，深层诉求合理**
   - 代码内部用 `phase0` / `phase1_5` / `phase2` 作为 state key，**但不会渲染到 UI**
   - UI 显示的是各组件写死的零散 h2 标题（见上表）
   - 但确实缺统一的"phase 总结性标签" + Stepper 导航体系

---

### 1.2 Phase2 聊天消息顺序 Bug

#### 关键文件

- `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx` — 主聊天组件
- `Echo/src/features/onboarding/v2/components/ChatBubble.tsx` — 纯展示气泡（无排序逻辑）
- `Echo/src/features/onboarding/v2/onboarding-v2.types.ts:204-229` — `ChatMessage` / `Conversation` 类型

#### 消息渲染逻辑

`Phase2Roleplay.tsx:825-846`：
```tsx
const visibleMessages = conversation.messages.filter(
  (msg) => msg.role === 'user' || !conversation.pendingDisplayIds.has(msg.id),
);
return visibleMessages.map((msg, idx) => { ... });
```

- 消息列表是数组 `conversation.messages`（`onboarding-v2.types.ts:216`）
- **渲染顺序 = 数组 push 顺序**，不按 `timestamp` / `id` / `sequence` 排序
- **关键过滤**：`user` 消息**永远显示**；`assistant` 消息**仅当不在 `pendingDisplayIds` 中时显示**
- `pendingDisplayIds` 是一个 Set，用来模拟"逐条打字弹出"动画 — assistant 消息虽然已 push 进数组，但在动画 timer 触发前被过滤隐藏

#### agent 回复插入逻辑

`Phase2Roleplay.tsx:523-529` — 纯 push 到末尾：
```tsx
return { ...prev, messages: [...prev.messages, ...assistantMsgs] };
```

`Phase2Roleplay.tsx:552-575` — API 完成后立即解锁 + 隐藏 + 逐条揭示：
```tsx
setApiPending(false);                                  // L552 ← 提前释放发送锁
setPendingDisplayIds(prev => new Set([...prev, ...newIds]));  // L558 ← assistant 消息加入隐藏集合

assistantMsgs.forEach((msg, idx) => {
  const typingDelay = data.replies[idx].delayMs > 0 ? data.replies[idx].delayMs : 800 + idx * 600;
  cumulativeDelay += typingDelay;
  const timer = setTimeout(() => {
    setPendingDisplayIds(prev => { next.delete(msgId); ... });  // L565-573 ← 延迟揭示
  }, cumulativeDelay);
});
```

#### 发送门控

`Phase2Roleplay.tsx:406`：
```tsx
if (!conversation || !inputText.trim() || apiPending) return;
```

**门控只看 `apiPending`，不看 `pendingDisplayIds.size`**。输入框 `disabled` 也只看 `!inputText.trim() || atMax`（`Phase2Roleplay.tsx:872`），不看 `apiPending` 或 `isTyping`。

#### 后端

`services/api/src/onboarding/roleplay-agent.service.ts:265-490` — 严格按请求顺序 push：
- `L281` 先 push 用户消息
- `L479-485` LLM 返回后再 push 所有 assistant 回复

后端**无并发锁**（两次并行 `chatTurn` 可能 lost-update，但与本 bug 无关）。后端**无辜**：单次请求内 user→assistant 顺序正确。

#### 根因 + 复现时间线

`Phase2Roleplay.tsx:552` 在 API 返回后**立即** `setApiPending(false)`，但此时 assistant 回复还在 `pendingDisplayIds` 中**隐藏**着，要等 `setTimeout`（默认 800ms 起跳）逐条揭示。这个"已解锁但 agent 气泡尚未浮现"的时间窗（单条 ~800ms，多条可达 2-4 秒）就是 bug 的触发窗口。

| 时刻 | 事件 | `messages` 数组 | `pendingDisplayIds` | 用户可见 |
|------|------|---------------|---------------------|---------|
| T0 | 用户发 msg1 | [..., msg1] | {} | msg1 |
| T1 | API 返回 agent1 | [..., msg1, agent1] | {agent1} | msg1（agent1 隐藏） |
| T1 | `setApiPending(false)` (L552) | 同上 | {agent1} | msg1 |
| T1+200ms | 用户发 msg2（L406 门控通过） | [..., msg1, agent1, msg2] | {agent1} | msg1, msg2 |
| T1+800ms | agent1 的 timer 触发 | 同上 | {} | **msg1, agent1, msg2** ← bug |
| T1+200ms+API | agent2 返回 | [..., msg1, agent1, msg2, agent2] | {agent2} | msg1, agent1, msg2 |

agent1 的气泡在 msg2 已经显示后才"补浮现"，由于数组顺序固定（agent1 在 msg2 之前），它出现在两条用户消息**之间**，与用户反馈完全一致。

**触发条件**:
1. agent 一轮回复 ≥1 条（必有）
2. 用户在 agent 气泡尚未全部浮现的窗口内（典型 0.8-4 秒）发送下一条消息
3. `apiPending` 已为 false（L552 已执行），`handleSend`（L406）放行
4. 用户消息 push 到 agent 回复之后（L425），但 agent 回复仍被 `pendingDisplayIds` 隐藏
5. 隐藏解除后，agent 回复按其数组位置（用户两条消息之间）浮现

#### 用户反馈验证

✅ **完全属实**。根因是 `Phase2Roleplay.tsx:552` 提前释放 `apiPending`，而 `Phase2Roleplay.tsx:406` 的发送门控未考虑 `pendingDisplayIds` 仍非空。后端顺序逻辑正确，无需改动。

> **修复策略说明**: 本方案**不修复"提前释放"**（即不禁止用户并发发送），而是**接受并发**，改用"按消息可见时间排序"的渲染逻辑（见 §3.4）。这样既保留了用户随时发消息的流畅体验，又修复了视觉错位，且后端 LLM 上下文管理完全不变。

---

## 二、改进后的用户体验变化

### 2.1 登录恢复弹窗

**当前**: 用户登录后，系统静默从上次 phase 继续，用户没有任何提示。

**改进后**: 用户登录后，若检测到有未完成 Onboarding session，先弹出一个模态对话框：

```
┌──────────────────────────────────────────┐
│        欢迎回到 Echo                     │
│                                          │
│   上次你已完成：                         │
│   ✓ 基础信息  ✓ 个人特征  ✓ 人格画像    │
│                                          │
│   下一步：理想型画像                     │
│                                          │
│   ┌─────────────┐  ┌─────────────────┐ │
│   │ 从这里继续  │  │ 回去改改前面   │ │
│   └─────────────┘  └─────────────────┘ │
└──────────────────────────────────────────┘
```

- "从这里继续" → 直接进入当前 phase
- "回去改改前面" → 关闭弹窗，显示顶部 Stepper，让用户点击任意已完成 phase 跳回

### 2.2 顶部 Stepper 跳转

**当前**: Onboarding 顶部只有一个右上角 X 退出按钮（`OnboardingShell.tsx:205-214`），无 phase 导航。

**改进后**: Onboarding 顶部增加一个水平 Stepper，显示所有 phase 的总结性标签：

```
   ●─────●─────●─────○─────○─────○
  基础  个人  人格  理想  角色  分身
  信息  特征  画像  型画像 对话  孵化
```

- ● 实心圆 = 已完成 phase（可点击跳回修改）
- ○ 空心圆 = 未完成 phase（不可点击，仅展示）
- 当前 phase 高亮显示
- 跳回已完成 phase 时：保留所有已填数据，用户可修改后重新提交；提交后自动跳回原最新 phase（即"上次到这里"的位置），不强制重新走完后续

**用户使用变化**:
- 用户在 phase2 想改 phase0 的名字 → 直接点 Stepper 第一个圆圈 → 修改 → 提交 → 自动跳回 phase2
- 不再需要"从头再来"或"将就着不改"

### 2.3 Phase2 聊天顺序修复

**当前**: 用户连发 2 条消息，agent 回复可能插在两条用户消息之间（因为 agent 回复 push 到数组时位置固定在用户后续消息之前，揭示时视觉上插中间）。

**改进后**: agent 回复**永远显示在当前最后一条消息下方**，不插中间。用户可以随时连发多条消息，agent 回复按"实际揭示时间"排序，视觉效果与微信/QQ 等 IM 软件一致 — 新消息总是出现在底部。

**用户使用变化**:
- 用户在 agent 打字动画期间可以继续发消息（不阻塞输入）
- agent 上一轮回复浮现时，会出现在用户最新消息的下方，而非插在中间
- LLM 上下文管理完全不变（后端依然串行：msg1 → agent1 → msg2 → agent2），仅前端渲染顺序调整
- 唯一语义偏差：agent1 视觉上显示在 msg2 之后，但语义上是回复 msg1 的。Phase2 是引导式对话，agent 回复针对上下文整体而非单条，此偏差可接受（与 IM 软件无引用回复时的默认行为一致）

---

## 三、实现路径

### 3.1 Phase 标签体系

新建 `Echo/src/features/onboarding/v2/phase-labels.ts`:

```ts
import { OnboardingPhase } from './onboarding-v2.types';

export const PHASE_LABELS: Record<OnboardingPhase, { short: string; full: string; description: string }> = {
  phase0:   { short: '基础信息', full: '基础信息',   description: '你的身份基座' },
  phase1:   { short: '个人特征', full: '个人特征',   description: '情境中的偏好反应' },
  phase1_5: { short: '人格画像', full: '你的人格画像', description: 'AI 综合的人格速写' },
  phase1_6: { short: '理想型',   full: '你需要什么样的人', description: '理想伙伴画像' },
  phase2:   { short: '角色对话', full: '和 TA 们聊聊',  description: '与四个角色深度对话' },
  finalize: { short: '分身孵化', full: '分身孵化',   description: '生成你的数字分身' },
};
```

各 phase 组件的 h2 标题可复用 `PHASE_LABELS[phase].full`，避免散落硬编码。

### 3.2 登录恢复弹窗

新建 `Echo/src/features/onboarding/v2/components/ResumeOnboardingDialog.tsx`:

- Props: `currentPhase`, `completedPhases`, `onResume`, `onEditPrevious`
- 在 `OnboardingShell.tsx:113-129` 的 session 恢复 useEffect 内，若 `session.completedPhases.length > 0`（即用户已完成至少 1 个 phase 才中断），则 `setShowResumeDialog(true)` 而非直接 `setPhase`
- 用户点击"从这里继续" → `setPhase(session.phase)` + 关闭弹窗
- 用户点击"回去改改前面" → 关闭弹窗，Stepper 自然显示，用户自行点击

**视觉**: 模态卡片，列出已完成的 phase（带 ✓ 标签 + 总结性词汇），下一步 phase 高亮。使用项目现有 glass morphism + magnetic button 风格。

### 3.3 顶部 Stepper + 用户主动跳转

#### 3.3.1 新增 Stepper 组件

新建 `Echo/src/features/onboarding/v2/components/PhaseStepper.tsx`:

- Props: `phases: OnboardingPhase[]`, `completedPhases: OnboardingPhase[]`, `currentPhase`, `onJumpTo(phase)`
- 渲染水平进度条，每个 phase 一个圆圈 + 标签（用 `PHASE_LABELS[phase].short`）
- 已完成 phase 可点击（cursor pointer + hover 微动画），未完成不可点击
- 当前 phase 高亮（边框加粗或颜色变化）
- 响应式：手机端折叠为"当前第 N 步：标签" + 下拉菜单

#### 3.3.2 OnboardingShell 状态机升级

`OnboardingShell.tsx`:
1. 新增 `userSelectedPhase` state（用户主动跳回的目标 phase，区别于 session 真实进度）
2. 新增 `jumpToPhase(target)` 函数：
   - 仅允许 target ∈ `completedPhases`
   - 设置 `userSelectedPhase = target`，但**不清空** `completedPhases`（保留真实进度）
   - `setPhase(target)` 进入对应组件
3. 用户在跳回的 phase 修改并提交后：
   - 若数据有变 → 后端 upsert（已是 upsert，无需改后端）
   - 提交成功 → 清空 `userSelectedPhase`，`setPhase(session.phase)` 回到原最新 phase
   - 提供"取消修改，返回"按钮 → 同上回到原最新 phase

#### 3.3.3 Stepper 摆放位置

`OnboardingShell.tsx:202-214` 当前布局：
- 右上角 X 退出按钮（fixed top-4 right-4）

改进后：
- 顶部增加一个 sticky header，Stepper 居中显示
- X 按钮保持在右上角，与 Stepper 并列
- Stepper 仅在 `phase !== 'finalize'` 时显示（finalize 是过渡屏，不需要导航）
- 移动端：Stepper 折叠为下拉/抽屉

### 3.4 Phase2 顺序修复（按 displayedAt 排序，独立小改）

**核心思路**: 给 `ChatMessage` 加一个 `displayedAt` 字段，表示"消息实际可见的时间"。渲染时按 `displayedAt` 升序排序，而非按数组 push 顺序。

- **user 消息**: `displayedAt` = push 时间（发送时间）
- **assistant 消息**: `displayedAt` = setTimeout 揭示回调触发时间（实际可见时间）

后端 `roleplay-agent.service.ts` **完全不动** — 它的 `chatWithId.messages` 数组顺序依然是 msg1 → agent1 → msg2 → agent2，LLM 上下文正确。仅前端 `conversation.messages` 的渲染顺序变化。

#### 改动 1: 类型扩展

`Echo/src/features/onboarding/v2/onboarding-v2.types.ts:204-211`:
```ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  segments: string[];
  displayedSegments: number;
  timestamp: number;
  displayedAt: number;  // ← 新增：消息实际可见的时间（user=发送时间，assistant=揭示时间）
}
```

#### 改动 2: user 消息 push 时设置 displayedAt

`Phase2Roleplay.tsx` 用户消息 push 处（L425 附近）:
```tsx
// 原: messages: [...prev.messages, { id, role: 'user', segments, ... }]
// 改: 加 displayedAt: Date.now()
messages: [...prev.messages, { id, role: 'user', segments, displayedAt: Date.now(), ... }]
```

#### 改动 3: agent 消息揭示时设置 displayedAt

`Phase2Roleplay.tsx:565-573` 的 setTimeout 回调内:
```tsx
// 揭示时（从 pendingDisplayIds 移除时）同步设置 displayedAt
setPendingDisplayIds(prev => { next.delete(msgId); ... });
// 新增: 更新对应消息的 displayedAt
setConversation(prev => ({
  ...prev,
  messages: prev.messages.map(m =>
    m.id === msgId ? { ...m, displayedAt: Date.now() } : m
  ),
}));
```

#### 改动 4: 渲染时按 displayedAt 排序

`Phase2Roleplay.tsx:825-830`:
```tsx
const visibleMessages = conversation.messages
  .filter(msg => msg.role === 'user' || !conversation.pendingDisplayIds.has(msg.id))
  .sort((a, b) => a.displayedAt - b.displayedAt);  // ← 新增排序
return visibleMessages.map((msg, idx) => { ... });
```

#### 时间线验证

| 时刻 | 事件 | `displayedAt` | 渲染顺序 |
|------|------|--------------|---------|
| T0 | 用户发 msg1 | msg1: T0 | msg1 |
| T0+50ms | API 返回 agent1，进入 pendingDisplayIds 隐藏 | agent1: 未设置 | msg1 |
| T0+200ms | 用户发 msg2 | msg2: T0+200ms | msg1, msg2 |
| T0+850ms | agent1 setTimeout 触发，揭示 | agent1: T0+850ms | **msg1, msg2, agent1** ✓ |
| T0+3000ms | agent2 揭示 | agent2: T0+3000ms | msg1, msg2, agent1, agent2 ✓ |

agent1 永远在末尾浮现，不再插中间。

#### 边界情况

- **agent1 与 agent2 揭示顺序**: 由于 LLM 调用串行（agent1 先返回才调 agent2），agent1 揭示时间必然早于 agent2，排序后相对位置正确。
- **时间戳精度**: 毫秒级足够（agent 揭示间隔通常 ≥600ms）。
- **历史消息回放**: 已完成对话恢复时，所有消息 `displayedAt` 可统一用 `timestamp` 兜底（按原顺序），不影响回放。

---

## 四、实现计划（分阶段）

按"先独立小改 → 再大改 UI 架构"顺序，每个阶段独立可验证、可回滚：

### 阶段 A: 修复 Phase2 聊天顺序（按 displayedAt 排序，独立可上线）

**目标**: agent 回复永远显示在当前最后一条消息下方，不插中间。后端 LLM 上下文不变。

**改动文件**（共 2 个）:
1. `Echo/src/features/onboarding/v2/onboarding-v2.types.ts`
2. `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx`

#### 步骤 A1: 扩展 ChatMessage 类型

文件: `onboarding-v2.types.ts:204-211`

```ts
// 改前
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  segments: string[];
  displayedSegments: number;
  timestamp: number;
}

// 改后
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  segments: string[];
  displayedSegments: number;
  timestamp: number;
  /**
   * 消息实际可见的时间（用于渲染排序）。
   * - user 消息: push 时 = Date.now()（发送时间）
   * - assistant 消息: 揭示时（setTimeout 触发）= Date.now()
   * - 历史消息恢复: 兜底用 timestamp
   */
  displayedAt: number;
}
```

#### 步骤 A2: user 消息 push 时设置 displayedAt

文件: `Phase2Roleplay.tsx:413-419`

```tsx
// 改前
const userMsg: ChatMessage = {
  id: nextMsgId(),
  role: 'user',
  segments: [inputText.trim()],
  displayedSegments: 1,
  timestamp: Date.now(),
};

// 改后
const now = Date.now();
const userMsg: ChatMessage = {
  id: nextMsgId(),
  role: 'user',
  segments: [inputText.trim()],
  displayedSegments: 1,
  timestamp: now,
  displayedAt: now,  // ← 新增
};
```

#### 步骤 A3: assistant 消息 push 时初始化 displayedAt

文件: `Phase2Roleplay.tsx:510-519`

```tsx
// 改前
const assistantMsgs: ChatMessage[] = data.replies.map((reply) => ({
  id: nextMsgId(),
  role: 'assistant' as const,
  segments: [reply.content],
  displayedSegments: 1,
  timestamp: Date.now(),
}));

// 改后
const assistantMsgs: ChatMessage[] = data.replies.map((reply) => ({
  id: nextMsgId(),
  role: 'assistant' as const,
  segments: [reply.content],
  displayedSegments: 1,
  timestamp: Date.now(),
  displayedAt: 0,  // ← 新增：揭示时更新为实际时间
}));
```

#### 步骤 A4: agent 消息揭示时更新 displayedAt

文件: `Phase2Roleplay.tsx:565-573`（setTimeout 回调内）

```tsx
// 改前
const timer = setTimeout(() => {
  setPendingDisplayIds((prev) => {
    const next = new Set(prev);
    next.delete(msgId);
    if (next.size === 0) setIsTyping(false);
    return next;
  });
}, cumulativeDelay);

// 改后
const timer = setTimeout(() => {
  setPendingDisplayIds((prev) => {
    const next = new Set(prev);
    next.delete(msgId);
    if (next.size === 0) setIsTyping(false);
    return next;
  });
  // 新增：同步更新 displayedAt 为揭示时间，确保渲染排序正确
  setConversation((prev) => {
    if (!prev) return prev;
    return {
      ...prev,
      messages: prev.messages.map((m) =>
        m.id === msgId ? { ...m, displayedAt: Date.now() } : m
      ),
    };
  });
}, cumulativeDelay);
```

#### 步骤 A5: 渲染时按 displayedAt 排序

文件: `Phase2Roleplay.tsx:828-830`

```tsx
// 改前
const visibleMessages = conversation.messages.filter(
  (msg) => msg.role === 'user' || !conversation.pendingDisplayIds.has(msg.id),
);

// 改后
const visibleMessages = conversation.messages
  .filter((msg) => msg.role === 'user' || !conversation.pendingDisplayIds.has(msg.id))
  .sort((a, b) => (a.displayedAt || a.timestamp) - (b.displayedAt || b.timestamp));
```

> **注意**: 用 `a.displayedAt || a.timestamp` 兜底，处理历史消息恢复时 `displayedAt` 可能为 0 的情况（旧数据没有这个字段）。

#### 步骤 A6: 历史消息恢复兜底

文件: `Phase2Roleplay.tsx` 中 `loadConversation` / `saveConversation` 相关逻辑（搜索 `loadConversation` 找到调用处）

在从 localStorage 加载历史消息后，对每条消息做兜底：
```tsx
// 加载历史消息后，补全缺失的 displayedAt
const restoredMessages = loaded.messages.map((m) => ({
  ...m,
  displayedAt: m.displayedAt || m.timestamp,  // 旧数据兜底
}));
```

#### 验证步骤

1. `npm --prefix Echo run lint` 通过（tsc --noEmit）
2. 启动 Phase2 聊天，连发 2 条消息（间隔 < 800ms）
3. 期望：agent 回复浮现时显示在第 2 条用户消息下方，不插中间
4. 多轮对话后检查消息顺序始终按"可见时间"递增
5. 退出 Phase2 重新进入，历史消息顺序正确（按 timestamp 兜底）

**改动行数**: ~15-20 行
**风险**: 极低（纯前端渲染逻辑，后端 LLM 上下文不变）
**回滚**: `git revert` 单次 commit 即可
**预计工时**: 30-45 分钟

### 阶段 B: 建立 Phase 标签体系（基础设施）

**目标**: 为阶段 C/D 的 Stepper 和弹窗提供统一的 phase 标签常量，替代各组件散落硬编码的标题。

**改动文件**:
1. 新建 `Echo/src/features/onboarding/v2/phase-labels.ts`
2. （可选）重构各 phase 组件的 h2 标题引用

#### 步骤 B1: 新建 phase-labels.ts

文件: `Echo/src/features/onboarding/v2/phase-labels.ts`（新建）

```ts
import type { OnboardingPhase } from './onboarding-v2.types';

export interface PhaseLabel {
  /** Stepper 圆圈下方的短标签（≤4 字） */
  short: string;
  /** phase 组件内的完整标题 */
  full: string;
  /** 弹窗/提示中用到的描述性文字 */
  description: string;
}

export const PHASE_LABELS: Record<OnboardingPhase, PhaseLabel> = {
  phase0:   { short: '基础信息', full: '基础信息',     description: '你的身份基座' },
  phase1:   { short: '个人特征', full: '个人特征',     description: '情境中的偏好反应' },
  phase1_5: { short: '人格画像', full: '你的人格画像', description: 'AI 综合的人格速写' },
  phase1_6: { short: '理想型',   full: '你需要什么样的人', description: '理想伙伴画像' },
  phase2:   { short: '角色对话', full: '和 TA 们聊聊',  description: '与四个角色深度对话' },
  finalize: { short: '分身孵化', full: '分身孵化',     description: '生成你的数字分身' },
};

/** 获取某个 phase 的短标签 */
export function getPhaseShortLabel(phase: OnboardingPhase): string {
  return PHASE_LABELS[phase]?.short ?? phase;
}

/** 获取某个 phase 的完整标题 */
export function getPhaseFullLabel(phase: OnboardingPhase): string {
  return PHASE_LABELS[phase]?.full ?? phase;
}
```

#### 步骤 B2: （可选）重构各 phase 组件标题

各 phase 组件中硬编码的 h2 标题改为引用 `PHASE_LABELS`：
- `Phase1_5Sketch.tsx` — "你的人格画像" → `PHASE_LABELS.phase1_5.full`
- `Phase1_6IdealSketch.tsx` — "你需要什么样的人？" → `PHASE_LABELS.phase1_6.full`
- `Phase2Roleplay.tsx` — "和 TA 们聊聊" → `PHASE_LABELS.phase2.full`
- `Finalize.tsx` — "分身正在生成" → `PHASE_LABELS.finalize.full`

> **注意**: 此步骤可选，不影响功能。若时间紧可跳过，仅在新组件（Stepper/弹窗）中使用 `PHASE_LABELS`。

#### 验证步骤

1. `npm --prefix Echo run lint` 通过
2. 在浏览器控制台执行 `PHASE_LABELS` 确认导入正常（或在新组件中引用验证）

**改动行数**: 新建 ~30 行 + 可选重构 ~10 行
**风险**: 极低（纯常量定义）
**回滚**: 删除新文件 + 还原重构
**预计工时**: 20-30 分钟

### 阶段 C: 顶部 Stepper UI + 用户主动跳转 + 首次修改弹窗

**目标**: Onboarding 顶部增加水平 Stepper，允许用户点击已完成 phase 跳回修改；跳回时首次弹出"不级联"提示。

**改动文件**（共 4 个）:
1. 新建 `Echo/src/features/onboarding/v2/components/PhaseStepper.tsx`
2. 新建 `Echo/src/features/onboarding/v2/components/EditWarningDialog.tsx`
3. 改 `Echo/src/features/onboarding/v2/OnboardingShell.tsx` — 接入 Stepper + 跳转状态机
4. 改各 phase 组件的 `onComplete` 回调签名（可选，见步骤 C5）

#### 步骤 C1: 新建 PhaseStepper 组件

文件: `Echo/src/features/onboarding/v2/components/PhaseStepper.tsx`（新建）

```tsx
import { PHASE_ORDER, type OnboardingPhase } from '../onboarding-v2.types';
import { PHASE_LABELS } from '../phase-labels';

interface PhaseStepperProps {
  currentPhase: OnboardingPhase;
  completedPhases: OnboardingPhase[];
  /** 用户主动跳回的目标 phase（null = 未跳回） */
  userSelectedPhase: OnboardingPhase | null;
  onJumpTo: (phase: OnboardingPhase) => void;
}

export function PhaseStepper({ currentPhase, completedPhases, userSelectedPhase, onJumpTo }: PhaseStepperProps) {
  // 实际显示的 phase：用户跳回时显示跳回的 phase，否则显示 currentPhase
  const displayPhase = userSelectedPhase ?? currentPhase;

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 overflow-x-auto">
      {PHASE_ORDER.map((phase, idx) => {
        const isCompleted = completedPhases.includes(phase);
        const isCurrent = displayPhase === phase;
        const isClickable = isCompleted;  // 仅已完成 phase 可点击跳回
        const label = PHASE_LABELS[phase].short;

        return (
          <div key={phase} className="flex items-center">
            {idx > 0 && (
              <div
                className="h-px w-4 sm:w-8"
                style={{ backgroundColor: isCompleted ? '#9b8aff' : '#d9e3f4' }}
              />
            )}
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onJumpTo(phase)}
              className="flex flex-col items-center gap-1 transition-transform"
              style={{
                cursor: isClickable ? 'pointer' : 'default',
                transform: isCurrent ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all"
                style={{
                  backgroundColor: isCompleted ? '#9b8aff' : 'transparent',
                  border: isCurrent ? '2px solid #9b8aff' : '2px solid #d9e3f4',
                  color: isCompleted ? '#fff' : '#7b7487',
                }}
              >
                {isCompleted ? '✓' : idx + 1}
              </div>
              <span
                className="text-[10px] sm:text-xs whitespace-nowrap"
                style={{ color: isCurrent ? '#4a4455' : '#7b7487' }}
              >
                {label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

#### 步骤 C2: 新建 EditWarningDialog 组件

文件: `Echo/src/features/onboarding/v2/components/EditWarningDialog.tsx`（新建）

```tsx
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'echo_onboarding_edit_warning_shown';

interface EditWarningDialogProps {
  /** 是否显示（外部根据 userSelectedPhase + localStorage 判断） */
  open: boolean;
  onClose: () => void;
}

export function EditWarningDialog({ open, onClose }: EditWarningDialogProps) {
  if (!open) return null;

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch { /* silent */ }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: 'rgba(74, 68, 85, 0.4)' }}>
      <div
        className="mx-6 max-w-sm rounded-2xl p-6"
        style={{ backgroundColor: '#fff', boxShadow: '0 20px 60px rgba(74, 68, 85, 0.15)' }}
      >
        <h3 className="text-lg font-semibold mb-3" style={{ color: '#4a4455' }}>提示</h3>
        <p className="text-sm leading-relaxed mb-5" style={{ color: '#7b7487' }}>
          修改这里只会更新当前阶段的数据，后面已生成的"人格画像""理想型画像"不会自动跟着更新。
          <br /><br />
          如果你想让后面的内容也反映这次修改，记得回到对应阶段重新生成。
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="w-full py-3 rounded-xl font-medium transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: '#9b8aff', color: '#fff' }}
        >
          我知道了
        </button>
      </div>
    </div>
  );
}

/** 工具函数：判断是否应该显示首次修改提示 */
export function shouldShowEditWarning(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'true';
  } catch {
    return true;
  }
}
```

#### 步骤 C3: OnboardingShell 状态机升级

文件: `Echo/src/features/onboarding/v2/OnboardingShell.tsx`

**C3.1 新增 state**（在 L31-34 附近）:
```tsx
const [phase, setPhase] = useState<OnboardingPhase>('phase0');
const [ready, setReady] = useState(false);
const [phaseError, setPhaseError] = useState<string | null>(null);
const [gender, setGender] = useState<string | undefined>();
// 新增 ↓
const [userSelectedPhase, setUserSelectedPhase] = useState<OnboardingPhase | null>(null);
const [showEditWarning, setShowEditWarning] = useState(false);
```

**C3.2 新增 jumpToPhase 函数**（在 goBackToPhase 之后，L176 附近）:
```tsx
// 用户主动跳回已完成 phase 修改（不清空 completedPhases，保留真实进度）
const jumpToPhase = useCallback(
  (targetPhase: OnboardingPhase) => {
    // 仅允许跳到已完成的 phase
    if (!(session?.completedPhases ?? []).includes(targetPhase)) return;
    setUserSelectedPhase(targetPhase);
    setPhase(targetPhase);
    // 首次修改提示
    if (shouldShowEditWarning()) {
      setShowEditWarning(true);
    }
  },
  [session],
);

// 从跳回的 phase 返回最新 phase（修改完成或取消）
const returnToLatestPhase = useCallback(() => {
  const latestPhase = session?.phase ?? 'phase0';
  setUserSelectedPhase(null);
  setPhase(latestPhase);
}, [session]);
```

**C3.3 修改 advancePhase 逻辑**（L132-158）:

当用户处于跳回状态（`userSelectedPhase !== null`）时，提交当前 phase 不应推进到下一个 phase，而应返回最新 phase：

```tsx
const advancePhase = useCallback(
  (currentPhase: OnboardingPhase) => {
    // 如果用户在跳回修改状态，提交后返回最新 phase，不推进
    if (userSelectedPhase !== null) {
      returnToLatestPhase();
      return;
    }
    // 原有推进逻辑不变 ↓
    const np = nextPhase(currentPhase);
    if (!np) { clear(); onComplete(); return; }
    if (currentPhase === 'phase1_6') {
      generateAgentProfiles().catch((err) => {
        console.warn('[OnboardingShell] generateAgentProfiles failed:', err);
      });
    }
    const newSession: OnboardingSession = {
      phase: np,
      completedPhases: [...(session?.completedPhases ?? []), currentPhase],
      savedAt: new Date().toISOString(),
    };
    save(newSession);
    setPhase(np);
  },
  [session, save, clear, onComplete, userSelectedPhase, returnToLatestPhase],
);
```

**C3.4 顶部接入 Stepper + EditWarningDialog**（替换 L202-214 的返回结构）:

```tsx
return (
  <div className="relative min-h-screen" style={{ backgroundColor: '#f8f9ff' }}>
    {/* 顶部 Stepper（finalize 阶段不显示） */}
    {phase !== 'finalize' && phase !== 'phase0' && (
      <div
        className="sticky top-0 z-40"
        style={{
          backgroundColor: 'rgba(248, 249, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e8e0f5',
        }}
      >
        <div className="relative flex items-center justify-center px-12 py-2">
          <PhaseStepper
            currentPhase={phase}
            completedPhases={session?.completedPhases ?? []}
            userSelectedPhase={userSelectedPhase}
            onJumpTo={jumpToPhase}
          />
          {/* 退出按钮保持在右上角 */}
          <button
            type="button"
            onClick={handleExit}
            className="absolute top-1/2 right-4 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: '#d9e3f4', color: '#4a4455' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* 用户跳回修改时的"返回最新进度"提示条 */}
        {userSelectedPhase !== null && (
          <div
            className="text-center py-1.5 text-xs cursor-pointer"
            style={{ backgroundColor: '#fff4e0', color: '#8a6a2a' }}
            onClick={returnToLatestPhase}
          >
            你正在修改已完成的内容 · 点击这里返回最新进度 →
          </div>
        )}
      </div>
    )}

    {/* 首次修改提示弹窗 */}
    <EditWarningDialog open={showEditWarning} onClose={() => setShowEditWarning(false)} />

    <AnimatePresence mode="wait">
      {/* ... 原有 phase 渲染逻辑不变 ... */}
    </AnimatePresence>
  </div>
);
```

#### 步骤 C4: 处理 phase0 的 Stepper 显示

phase0 是第一个 phase，通常 `completedPhases` 为空，Stepper 没有可跳转的目标。当前设计 phase0 不显示 Stepper（见 C3.4 的 `phase !== 'phase0'` 条件），与现有"phase0 无退出按钮"一致。

#### 步骤 C5: 各 phase 组件的"取消修改"入口（可选增强）

各 phase 组件（`Phase0Identity` / `Phase1Cards` / `Phase1_5Sketch` / `Phase1_6IdealSketch`）在用户跳回修改时，可显示一个"取消修改，返回"按钮，调用 `returnToLatestPhase`。

实现方式：通过 props 传入 `isEditing?: boolean` 和 `onCancelEdit?: () => void`：
```tsx
<Phase0Identity
  userId={userId}
  onComplete={() => advancePhase('phase0')}
  onClose={handleExit}
  isEditing={userSelectedPhase === 'phase0'}
  onCancelEdit={returnToLatestPhase}
/>
```

各组件内部根据 `isEditing` 显示不同的标题（如"修改基础信息" vs "基础信息"）和"取消"按钮。

> **注意**: 此步骤可选。最小实现可仅依赖顶部 Stepper 的"返回最新进度"提示条（C3.4 已包含）。

#### 验证步骤

1. `npm --prefix Echo run lint` 通过
2. 启动 Onboarding，完成 phase0 → phase1，顶部 Stepper 显示：● 基础信息 ○ 个人特征 ...
3. 点击"基础信息"圆圈 → 首次弹出修改提示弹窗 → 点"我知道了" → 进入 phase0 修改界面
4. 顶部显示黄色提示条"你正在修改已完成的内容 · 点击这里返回最新进度 →"
5. 修改名字后提交 → 自动跳回 phase1（不推进到 phase2）
6. 点击黄色提示条 → 直接返回 phase1（不保存修改）
7. 再次点击"基础信息"圆圈 → 不再弹提示弹窗（localStorage 已标记）

**改动行数**: 新建 ~200 行 + 改 OnboardingShell ~60 行
**风险**: 中（状态机改动，需充分测试 userSelectedPhase 与 session.completedPhases 的交互）
**回滚**: 删除新建组件 + `git revert` OnboardingShell 改动
**预计工时**: 2-3 小时

### 阶段 D: 登录恢复弹窗

**目标**: 用户登录后若检测到未完成 Onboarding session（且已完成至少 1 个 phase），弹出模态对话框提示上次进度，让用户选择"从这里继续"或"回去改改前面"。

**改动文件**（共 2 个）:
1. 新建 `Echo/src/features/onboarding/v2/components/ResumeOnboardingDialog.tsx`
2. 改 `Echo/src/features/onboarding/v2/OnboardingShell.tsx` — 接入弹窗

#### 步骤 D1: 新建 ResumeOnboardingDialog 组件

文件: `Echo/src/features/onboarding/v2/components/ResumeOnboardingDialog.tsx`（新建）

```tsx
import { PHASE_ORDER, type OnboardingPhase } from '../onboarding-v2.types';
import { PHASE_LABELS } from '../phase-labels';

interface ResumeOnboardingDialogProps {
  open: boolean;
  currentPhase: OnboardingPhase;
  completedPhases: OnboardingPhase[];
  onResume: () => void;
  onEditPrevious: () => void;
}

export function ResumeOnboardingDialog({
  open, currentPhase, completedPhases, onResume, onEditPrevious,
}: ResumeOnboardingDialogProps) {
  if (!open) return null;

  const nextPhaseLabel = PHASE_LABELS[currentPhase];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(74, 68, 85, 0.5)' }}
    >
      <div
        className="mx-6 max-w-md rounded-3xl p-8"
        style={{
          backgroundColor: '#fff',
          boxShadow: '0 24px 80px rgba(74, 68, 85, 0.2)',
        }}
      >
        <h2 className="text-2xl font-semibold mb-1" style={{ color: '#4a4455' }}>
          欢迎回到 Echo
        </h2>
        <p className="text-sm mb-6" style={{ color: '#7b7487' }}>
          上次你已完成：
        </p>

        {/* 已完成 phase 列表 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {completedPhases.map((phase) => (
            <div
              key={phase}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#f0ebff', color: '#6b5aff' }}
            >
              <span>✓</span>
              <span>{PHASE_LABELS[phase].short}</span>
            </div>
          ))}
        </div>

        {/* 下一步提示 */}
        <div
          className="rounded-2xl p-4 mb-6"
          style={{ backgroundColor: '#f8f9ff', border: '1px solid #e8e0f5' }}
        >
          <p className="text-xs mb-1" style={{ color: '#7b7487' }}>下一步</p>
          <p className="text-base font-medium" style={{ color: '#4a4455' }}>
            {nextPhaseLabel.full}
          </p>
          <p className="text-xs mt-1" style={{ color: '#7b7487' }}>
            {nextPhaseLabel.description}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3.5 rounded-xl font-medium transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: '#9b8aff', color: '#fff' }}
          >
            从这里继续
          </button>
          <button
            type="button"
            onClick={onEditPrevious}
            className="w-full py-3.5 rounded-xl font-medium transition-colors"
            style={{ backgroundColor: 'transparent', color: '#7b7487', border: '1px solid #d9e3f4' }}
          >
            回去改改前面
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 步骤 D2: OnboardingShell 接入弹窗

文件: `Echo/src/features/onboarding/v2/OnboardingShell.tsx`

**D2.1 新增 state**（在 C3.1 新增的 state 之后）:
```tsx
const [showResumeDialog, setShowResumeDialog] = useState(false);
```

**D2.2 修改 session 恢复 useEffect**（L113-129）:

原逻辑是恢复 session 后直接 `setPhase(session.phase)`。改为：若 `completedPhases.length > 0` 则先弹窗，否则直接进入。

```tsx
// session 恢复后设置 phase（校验有效性）
useEffect(() => {
  if (!ready) return;
  if (session?.phase) {
    const targetIdx = PHASE_ORDER.indexOf(session.phase);
    const allPriorDone = PHASE_ORDER.slice(0, targetIdx).every(
      (p) => session.completedPhases.includes(p),
    );
    if (allPriorDone) {
      // 新增：若已完成至少 1 个 phase，弹窗让用户选择
      if (session.completedPhases.length > 0 && session.phase !== 'finalize') {
        setShowResumeDialog(true);
        // 注意：不立即 setPhase，等用户选择后再 setPhase
        // 但需要先设置一个临时 phase 避免渲染空白
        setPhase(session.phase);
      } else {
        setPhase(session.phase);
      }
    } else {
      clear();
      setPhase('phase0');
    }
  }
}, [ready, session, clear]);
```

**D2.3 弹窗回调处理**:

```tsx
const handleResume = useCallback(() => {
  setShowResumeDialog(false);
  // phase 已在 useEffect 中设置，无需再设
}, []);

const handleEditPrevious = useCallback(() => {
  setShowResumeDialog(false);
  // 关闭弹窗后，Stepper 自然显示，用户自行点击跳回
  // 不自动跳到任何 phase，让用户主动选择
}, []);
```

**D2.4 渲染弹窗**（在 EditWarningDialog 之后）:

```tsx
<ResumeOnboardingDialog
  open={showResumeDialog}
  currentPhase={session?.phase ?? 'phase0'}
  completedPhases={session?.completedPhases ?? []}
  onResume={handleResume}
  onEditPrevious={handleEditPrevious}
/>
```

#### 验证步骤

1. `npm --prefix Echo run lint` 通过
2. 完成 phase0 后退出 Onboarding（点右上角 X）
3. 重新登录 → 弹窗显示"欢迎回到 Echo / 上次你已完成：✓ 基础信息 / 下一步：个人特征"
4. 点击"从这里继续" → 弹窗关闭，进入 phase1
5. 点击"回去改改前面" → 弹窗关闭，Stepper 显示，当前在 phase1，可点击"基础信息"跳回
6. 在 phase0 第一个字段就退出 → 重新登录 → **不弹窗**（completedPhases 为空），直接进入 phase0

**改动行数**: 新建 ~100 行 + 改 OnboardingShell ~25 行
**风险**: 低（弹窗逻辑独立，不影响已恢复的 session 数据；phase 已预设避免空白屏）
**回滚**: 删除新建组件 + `git revert` OnboardingShell 改动
**预计工时**: 1-1.5 小时

### 阶段 E: 移动端响应式（可选优化）

**目标**: Stepper 和弹窗在窄屏（< 640px）下优雅折叠，避免拥挤。

**改动文件**（共 3 个）:
1. 改 `Echo/src/features/onboarding/v2/components/PhaseStepper.tsx`
2. 改 `Echo/src/features/onboarding/v2/components/ResumeOnboardingDialog.tsx`
3. 改 `Echo/src/features/onboarding/v2/components/EditWarningDialog.tsx`

#### 步骤 E1: PhaseStepper 窄屏折叠

文件: `PhaseStepper.tsx`

桌面端（≥ 640px）保持水平圆圈 + 标签。移动端（< 640px）折叠为紧凑模式：

```tsx
// 在 PhaseStepper 组件 return 之前加判断
// 方案：用 Tailwind 的 sm: 前缀控制显示
// 移动端只显示"第 N 步：当前标签"，点击展开完整 Stepper

export function PhaseStepper({ currentPhase, completedPhases, userSelectedPhase, onJumpTo }: PhaseStepperProps) {
  const displayPhase = userSelectedPhase ?? currentPhase;
  const currentIdx = PHASE_ORDER.indexOf(displayPhase);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* 移动端紧凑模式（< 640px） */}
      <div className="sm:hidden flex items-center gap-2" onClick={() => setExpanded(!expanded)}>
        <span className="text-xs" style={{ color: '#7b7487' }}>
          第 {currentIdx + 1} 步
        </span>
        <span className="text-sm font-medium" style={{ color: '#4a4455' }}>
          {PHASE_LABELS[displayPhase].short}
        </span>
        <ChevronDown className="w-4 h-4" style={{ color: '#7b7487' }} />
      </div>

      {/* 桌面端完整模式（≥ 640px） + 移动端展开时 */}
      <div className={`${expanded ? 'flex' : 'hidden'} sm:flex items-center justify-center gap-1 sm:gap-2`}>
        {/* ... 原有 PHASE_ORDER.map 渲染逻辑 ... */}
      </div>
    </>
  );
}
```

#### 步骤 E2: ResumeOnboardingDialog 小屏适配

文件: `ResumeOnboardingDialog.tsx`

```tsx
// 弹窗容器在小屏时改为底部抽屉式
<div
  className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
  style={{ backgroundColor: 'rgba(74, 68, 85, 0.5)' }}
>
  <div
    className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
    style={{ backgroundColor: '#fff' }}
  >
    {/* ... 原有内容 ... */}
  </div>
</div>
```

#### 步骤 E3: EditWarningDialog 小屏适配

同 E2，改 `items-center` → `items-end sm:items-center`，`rounded-3xl` → `rounded-t-3xl sm:rounded-3xl`。

#### 验证步骤

1. Chrome DevTools 切换到 iPhone SE (375px) 视口
2. Onboarding 顶部 Stepper 显示"第 N 步：标签"，点击展开完整 Stepper
3. 登录恢复弹窗从底部滑入，可上下滚动
4. 首次修改提示弹窗同样从底部滑入
5. 桌面端（≥ 640px）布局不变

**改动行数**: ~40 行
**风险**: 低（纯样式调整，不影响逻辑）
**回滚**: `git revert` 单次 commit
**预计工时**: 1 小时

---

## 五、关键风险与权衡

### 5.1 跳回已完成 phase 后，后续 phase 数据是否失效？

**当前设计**: 跳回 phase0 修改名字，phase1/phase1_5/... 的已存数据**保留**。但有个语义问题：如果用户改了名字，phase1_5 的人格画像是基于旧名字生成的，是否需要重新生成？

**决策（已确认）**: 不自动重新生成。用户跳回 phase0 改名字 → 仅 phase0 数据更新，后续 phase 数据保持不变。若用户想刷新 phase1_5 的人格画像，需主动重新触发（如 phase1_5 页面加一个"重新生成"按钮）。这与现有"用户主动控制"的产品哲学一致。

**首次修改提示弹窗（已确认新增）**: 用户**第一次**触发"跳回已完成 phase 修改"时，弹出一个一次性提示：

```
┌──────────────────────────────────────────┐
│            提示                           │
│                                          │
│   修改这里只会更新当前阶段的数据，        │
│   后面已生成的"人格画像""理想型画像"     │
│   不会自动跟着更新。                      │
│                                          │
│   如果你想让后面的内容也反映这次修改，    │
│   记得回到对应阶段重新生成。              │
│                                          │
│              [ 我知道了 ]                │
└──────────────────────────────────────────┘
```

- 触发条件：`userSelectedPhase !== null`（即用户主动跳回）且 `localStorage.getItem('echo_onboarding_edit_warning_shown') !== 'true'`
- 用户点击"我知道了" → `localStorage.setItem('echo_onboarding_edit_warning_shown', 'true')` + 关闭弹窗
- 同一用户只显示一次（后续跳回不再打扰）

**风险等级**: 中 → 低（已通过提示弹窗缓解语义混淆）

### 5.2 Phase2 顺序修复后的语义偏差

**当前设计（按 displayedAt 排序）**: agent 回复永远显示在当前最后一条消息下方，与 IM 软件习惯一致。但如果用户连发 3 条消息（msg1, msg2, msg3）后 agent1 揭示，显示顺序是 msg1, msg2, msg3, agent1 — agent1 视觉上在 msg3 之后，语义上是回复 msg1 的。

**权衡**: Phase2 是引导式深度对话，agent 回复针对上下文整体而非单条消息，此偏差可接受（与微信/QQ 无引用回复时的默认行为一致）。LLM 上下文管理完全不变（后端依然串行），仅前端渲染顺序调整。

**未来可选增强**: 若需明确"agent 回复哪条"，可在消息模型加 `replyTo` 字段做引用气泡，但这是更大的改造，不在本次范围。

**风险等级**: 低 — 与产品场景匹配，且不阻塞未来扩展。

### 5.3 Stepper 在窄屏的展示

**当前设计**: 6 个 phase 标签水平排列，移动端会拥挤。
**对策**: 阶段 E 单独处理移动端折叠，桌面端先上线。

**风险等级**: 低 — 桌面端先验证，移动端可延后。

### 5.4 弹窗的触发条件

**建议**: 仅当 `completedPhases.length > 0` 时弹窗（即用户至少完成 1 个 phase 才中断）。如果用户在 phase0 第一个字段就退出，下次登录不弹窗，直接从 phase0 开始（避免对刚入门的用户造成干扰）。

**风险等级**: 低 — 触发条件清晰。

---

## 六、未决问题确认结果

1. **Phase 标签词汇** — ✅ **已确认**："基础信息/个人特征/人格画像/理想型/角色对话/分身孵化"
2. **跳回修改的级联语义** — ✅ **已确认**：不级联 + 首次修改弹窗提示（见 §5.1）
3. **弹窗触发条件** — ✅ **已确认**：仅当 `completedPhases.length > 0` 时弹窗
4. **Phase2 顺序修复方案** — ✅ **已确认**：按 `displayedAt` 排序方案
5. **实施顺序** — ✅ **已确认**：A → B → C → D → E

---

## 七、附录：关键代码引用索引

### 前端 Onboarding
- `Echo/src/features/onboarding/v2/onboarding-v2.types.ts:11-20` — PHASE_ORDER
- `Echo/src/features/onboarding/v2/OnboardingShell.tsx:47-110` — 登录恢复 useEffect
- `Echo/src/features/onboarding/v2/OnboardingShell.tsx:113-129` — session 恢复后 setPhase
- `Echo/src/features/onboarding/v2/OnboardingShell.tsx:132-158` — advancePhase
- `Echo/src/features/onboarding/v2/OnboardingShell.tsx:161-176` — goBackToPhase
- `Echo/src/features/onboarding/v2/OnboardingShell.tsx:202-264` — 主渲染结构

### 前端 Phase2 聊天
- `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx:406` — 发送门控（待加强）
- `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx:523-529` — agent 消息 push 到末尾
- `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx:552-575` — 提前解锁 + 隐藏 + 逐条揭示
- `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx:825-846` — 消息渲染过滤
- `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx:872` — 输入框 disabled 条件
- `Echo/src/features/onboarding/v2/onboarding-v2.types.ts:204-229` — ChatMessage / Conversation 类型

### 后端
- `services/api/src/onboarding/onboarding.controller.ts:64-67` — GET /onboarding/progress
- `services/api/src/onboarding/onboarding.service.ts:259-319` — getProgress 实现
- `services/api/src/onboarding/onboarding.service.ts:151-208, 326-398` — submitPhase0/submitPhase1（已是 upsert）
- `services/api/src/onboarding/roleplay-agent.service.ts:265-490` — chatTurn（后端顺序正确，无需改）
