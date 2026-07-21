# Echo 后端三处数据存储缺陷修复

## 任务概述

修复 Echo 后端 3 个数据存储问题：`matchPrefs` 不保存、社交统计混算、理想型不可查询。

涉及文件：
- `services/api/src/onboarding/onboarding.service.ts` — `submitPhase0` / `finalize`
- `services/api/src/clones/clones.service.ts` — `getMe`
- `services/api/src/clones/clones.controller.ts` — `GET /clones/me` 类型声明

## 改动详情

### 1. `submitPhase0` 写入 `Profile.matchPrefsJson`

**问题**：Phase 0 收集的 `matchPreference`（偏好性别/年龄/城市/职业）和 `goalOnEcho`（关系意图）只写入 `bioJson`，未写入 `Profile.matchPrefsJson` 列，导致匹配服务读取不到结构化偏好。

**修复**：
- 新增私有方法 `buildMatchPrefsJson(dto)`：从 `dto.matchPreference` 提取 4 个偏好字段，把 `dto.goalOnEcho` 合并为 `relationshipIntent`。
- 若 dto 中无任何偏好信息则返回 `null`，保留 Profile 旧值不覆盖。
- 在 `Profile.upsert` 的 create / update 中条件写入 `matchPrefsJson`，保持 `bioJson` 写入逻辑不变。

### 2. `getMe` 社交统计分项返回

**问题**：`interactionCount` 把 post + comment + like + session 四类混算成一个数字，前端无法分别展示，且 matchCount 应反映"唯一匹配数"而非 session 总数。

**修复**：
- 在 `Promise.all` 中新增 `agentSession.findMany` 拉取所有相关 session 的 `(cloneAId, cloneBId)`。
- 用 `Set<string>` 去重，把 `(A,B)` 与 `(B,A)` 视为同一对匹配，统计不同的对方 clone 数作为 `matchCount`。
- 防御性过滤 `cloneA === cloneB` 的自匹配 session。
- 返回结构新增 `socialStats: { postCount, commentCount, matchCount }`，同时保留 `interactionCount` 向后兼容。

### 3. `clones.controller.ts` 添加返回类型声明

- 导出 `GetMeResponseDto` interface，显式声明 `id / status / consentAt / persona / boundaries / interactionCount / socialStats` 字段。
- `me()` 方法签名改为 `Promise<GetMeResponseDto>`，让 TypeScript 编译器在 service 返回结构变更时报错，保证类型契约一致。
- 从 `clone-boundaries` 复用 `CloneBoundaries` 类型，避免重复定义。

### 4. `finalize` 阶段同步 `bioJson` 包含 `idealPartnerSketch`

**问题**：`IdealPartnerSketchService.generate/adjust` 已 dual-write `Profile.bioJson`，但若用户在 Phase 1.6 之后又调整了 Phase 2 角色扮演或维度数据，`bioJson` 可能与 `OnboardingSession.surveyJson` 不一致，导致下游查询 `Profile.bioJson.idealPartnerSketch` 取不到。

**修复**：
- 把 styleMd 写入 try-catch 之外，统一在 finalize 时同步 `OnboardingSession.surveyJson` 到 `Profile.bioJson`。
- 若 `styleMd` 已生成，与 `bioJson` 一起 upsert（避免两次数据库写入）。
- 这样保证 `Profile.bioJson` 一定包含最新的 `idealPartnerSketch / personaSketch / roleplayChats`。

## 验证

```bash
cd services/api && npm run lint
```

结果：`tsc --noEmit` 退出码 0，无 TypeScript 编译错误。

## 影响范围

- 数据库 schema：无变更（`Profile.matchPrefsJson` 列已存在）
- API 契约：`GET /clones/me` 返回结构新增 `socialStats` 字段（向后兼容，旧字段 `interactionCount` 保留）
- 前端：可分别展示 post / comment / match 三类社交统计，但旧前端代码不受影响
- 匹配服务：可读取 `Profile.matchPrefsJson` 做更精准的偏好过滤
- 理想型查询：`Profile.bioJson.idealPartnerSketch` 在 finalize 后保证存在
