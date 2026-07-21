# Phase 2 三项修复总览

## 修复 1：Phase 2 聊天头像改为文字头像

**问题**：用户每次进入 Phase 2 聊天界面都要重新加载图片头像。

**方案**：弃用图片头像，改用单字文字头像。

| 角色 | displayName | avatarText | avatarColor |
|------|-------------|------------|-------------|
| bestfriend | 小鹿 | 鹿 | #FFB74D (橙) |
| crush | 小夜 | 夜 | #7C7AE0 (紫) |
| stranger | 阿远 | 远 | #26A69A (青) |
| disappointed | 阿辰 | 辰 | #78909C (灰蓝) |

**改动文件**：
- `Echo/src/features/onboarding/v2/onboarding-v2.types.ts` — RoleAgentDef 新增 `avatarText` + `avatarColor`
- `Echo/src/features/onboarding/v2/roleplay-agents.data.ts` — 移除 avatarUrl，添加文字头像
- `Echo/src/features/onboarding/v2/components/ChatBubble.tsx` — `<img>` → 圆形文字 `<div>`
- `Echo/src/features/onboarding/v2/components/RoleCard.tsx` — 同上
- `Echo/src/features/onboarding/v2/Phase2Roleplay.tsx` — Header + ChatBubble 调用

---

## 修复 2：小鹿 agent 聊天 bug

**问题**：
1. 用户一发消息就被踢回 Phase 2 选择界面
2. 退出后小鹿 agent 不会像其他 agent 那样继续发消息

**真正根因（通过数据库查询 + API 调用验证）**：

小鹿的旧对话在数据库中已结束（`endedAt: 1782873719034`），但前端 localStorage 仍保存着旧 chatId。每次用户选择小鹿进入聊天时，前端从 localStorage 恢复旧对话（不调用 `startRoleplay`），用户发消息使用旧 chatId → 后端返回 400"对话已结束" → 前端踢回选择界面。

其他 3 个 agent 没有这个问题，因为它们的旧对话要么已被 `handleEnd` 清理（如 crush），要么从未结束（如 stranger 和 disappointed）。

**验证过程**：
1. 查询数据库：bestfriend chat `endedAt > 0`（已结束），chatId = `rp_mr1gqal9_4l0nk6k1`
2. 用旧 chatId 调 API → 400 "对话已结束"
3. 用 `startRoleplay` 创建新 chatId → 正常返回回复
4. LLM 直接调用 → 正常返回（排除 LLM 故障）

**修复方案**（`Phase2Roleplay.tsx` handleSend 的 `!res.ok` 分支）：

当发消息遇到 400 错误时，不再踢回选择界面，而是：
1. `removeConversation` 清理旧的已失效对话
2. `startRoleplay` 创建新对话
3. 把用户消息放进新对话
4. 用新 chatId 重发消息
5. 成功则展示新对话 + 回复；失败才踢回

这样既保留了 localStorage 持久化设计，又解决了旧对话卡死的问题。用户无感知地从旧对话切换到新对话。

**额外保留**：`isFarewell()` 移除"我去"关键词改用正则精确匹配 — 不是根因但仍是合理改进（"我去"常作感叹词）。

---

## 修复 3：加载动画手机显示过大且不居中

**问题**：Phase 1 结束后，人格画像（Phase1_5Sketch）和理想伴侣（Phase1_6IdealSketch）页面的加载动画在手机上显示很大且不居中。但 Phase 1 中 4 个部分的相同加载动画显示正常。

**根因**：loading 状态的容器 className 缺少 `max-w-[375px] mx-auto text-center`（同文件的 error 状态有这些 class，loading 状态遗漏了），且 LottieLoader 没有用 `flex justify-center` 包裹。

**修复**：3 个文件的 loading 状态都补齐了容器约束和 LottieLoader 包裹：
- `Echo/src/features/onboarding/v2/Phase1_5Sketch.tsx`
- `Echo/src/features/onboarding/v2/Phase1_6IdealSketch.tsx`
- `Echo/src/features/clone/IdealPartnerSetup.tsx`（bonus 修复）

---

## 验证

- 前端 `npx tsc --noEmit`：退出码 0（3 个 pre-existing poster 模块报错与本次修改无关）
- 后端 `npx tsc --noEmit`：退出码 0，无错误
