# Phase A 实施完成 — 后端 GET 查询能力建设

> **日期**：2026-07-20
> **方案文档**：`outputs/onboarding-resume-fix-plan.md`（v2）
> **改动文件数**：4 个（后端 3 + 前端 1）
> **lint 验证**：后端 `tsc --noEmit` 退出码 0；前端 `tsc --noEmit` 退出码 0

---

## 改动清单

### 1. `services/api/src/onboarding/onboarding.controller.ts`
- import 加入 `Get`
- 新增 `@Get('progress')` 端点 → 调用 `onboarding.getProgress(userId)`
- 新增 `@Get('roleplay/chats')` 端点 → 调用 `roleplayAgent.listChats(userId)`

### 2. `services/api/src/onboarding/onboarding.service.ts`
- 新增 `getProgress(userId)` 方法（紧跟 `estimateBirthYear` 之后）
- 从 `OnboardingSession.surveyJson` 字段存在性推断 `currentPhase`
- 返回结构：
  ```ts
  {
    hasActiveSession: boolean,
    sessionId?: string,
    currentPhase?: string,  // 'phase0' | 'phase1' | 'phase1_5' | 'phase1_6' | 'phase2' | 'finalize'
    phase0Data?: identity,  // Phase 0 已保存字段
    phase1Responses?: ScenarioResponse[],  // Phase 1 卡片回答
    phase2CompletedRoles?: string[],  // 已完成 roleId 列表
  }
  ```
- 推断逻辑：
  - `roleplayChats` 有 `endedAt > 0` → `finalize`
  - `roleplayChats` 非空 或 `agentProfiles` 存在 → `phase2`
  - `idealPartnerSketch` 存在 → `phase1_6`
  - `personaSketch` 存在 → `phase1_5`
  - `scenarioCards` 非空 或 `identity` 存在 → `phase1`
  - 否则 → `phase0`

### 3. `services/api/src/onboarding/roleplay-agent.service.ts`
- 新增导出类型 `RoleplayChatSummary` 和 `StartChatResponse`
- 改造 `startChat()` 返回 `StartChatResponse`（含 `status / existingMessages / endedReason`）
- 三分支逻辑：
  - **existingChat 未结束**（`endedAt=0`）→ 复用，返回 `status='active'`
  - **existingChat 已结束**（`endedAt>0`）→ 返回 `status='ended'` + `existingMessages` + `endedReason`，**不自动新建**
  - **不存在** → 新建，返回 `status='active'`
- 新增 `listChats(userId)` 方法（纯读，幂等）：返回所有 chat 状态概要
- `endedReason` 推断：`qualityFlag='incomplete'` → `auto_farewell`；其他 → `manual`

### 4. `Echo/src/features/onboarding/v2/onboarding-v2.api.ts`
- import 加入 `apiGetJson` 和 `OnboardingPhase` 类型
- 新增 `OnboardingProgress` 类型 + `getOnboardingProgress()` 函数
- 新增 `RoleplayChatSummary` 类型 + `listRoleplayChats()` 函数
- 扩展 `RoleplayStartResponse` 类型加 `status / existingMessages / endedReason` 字段

---

## 新增 API 端点

### `GET /v1/onboarding/progress`
**用途**：查询入驻整体进度，支持跨设备/清缓存后恢复
**返回**：
```json
{
  "hasActiveSession": true,
  "sessionId": "sess_xxx",
  "currentPhase": "phase2",
  "phase0Data": { "displayName": "...", "genderIdentity": "male", ... },
  "phase1Responses": [{ "cardId": "forest_cabin", "choice": "A", ... }],
  "phase2CompletedRoles": ["crush", "bestfriend"]
}
```

### `GET /v1/onboarding/roleplay/chats`
**用途**：查询所有 roleplay chat 状态，前端 mount 时同步 completedRoles
**返回**：
```json
{
  "chats": [
    {
      "chatId": "rp_xxx",
      "roleName": "crush",
      "agentName": "小夜",
      "status": "ended",
      "messageCount": 18,
      "startedAt": 1721779200000,
      "endedAt": 1721780000000,
      "endedReason": "auto_farewell"
    }
  ]
}
```

### `POST /v1/onboarding/roleplay/start`（改造）
**新返回结构**：
```json
{
  "chatId": "rp_xxx",
  "openingMessage": "...",
  "agentName": "小夜",
  "status": "active",  // 或 "ended"
  "existingMessages": [...],  // 仅 status='ended' 时返回
  "endedReason": "auto_farewell"  // 仅 status='ended' 时返回
}
```

---

## 设计决策

1. **`startChat` 在 chat 已 ended 时不自动新建**：把决定权交给前端。前端识别 `status='ended'` 后把 roleId 加入 `completedRoles` 并停留角色屏。如果未来要支持重聊，再加 `?force_new=true` 参数。

2. **`currentPhase` 用推断逻辑而非新数据库字段**：避免数据库迁移，可立即上线。边界场景可能不准（如 phase1_5 调整 sketch 时退出会推断成 phase1_6），但不会卡死，用户跳到下一个 phase 也能正常推进。

3. **`endedReason` 用 `qualityFlag` 启发式推断**：`'incomplete'` 通常是自动告别结束（对话未达 3 轮），其他情况是手动结束。只用于前端展示，不影响正确性。

4. **`listChats` 是纯读操作**：幂等，不修改 `surveyJson`，可频繁调用。

---

## 验证结果

```
后端：cd services/api && npm run lint
  > tsc --noEmit
  退出码 0 ✅

前端：npm --prefix Echo run lint
  > tsc --noEmit
  退出码 0 ✅
  (3 个预先存在的 poster 模块错误与本次改动无关)
```

---

## 后续 Phase 可复用的能力

| Phase | 复用的能力 | 用法 |
|---|---|---|
| Phase B（Bug ② 死循环） | `listRoleplayChats()` | Phase2Roleplay mount 时同步 completedRoles |
| Phase B（Bug ② 死循环） | `startRoleplay()` 返回 status | handleSelectRole 据此决定是否进入对话 |
| Phase D（Bug ① 字段恢复） | `getOnboardingProgress()` | OnboardingShell mount 时拿权威 currentPhase + 字段 |

---

## 下一步

Phase A 完成，可以开始 Phase B（Bug ② Phase 2 死循环修复）。Phase B 改动集中在 `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx` 一个文件，预计 0.5-1 天。
