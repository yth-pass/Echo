# 设置页修复 + 社交边界设置 — Overview

## 完成内容

修复 Echo 设置页面三个问题，并新增社交边界独立设置入口。前端 TypeScript 编译通过（`tsc --noEmit` 退出码 0）。

## 问题与修复

### 1. SettingsView 信息消失（根因 + 修复）
**根因**：设置子页面（`/settings/prefs` 等）是 `/*` 的同级路由，导航进去时 MainLayout 卸载、SettingsView 的 profile state 丢失；返回 `/settings` 时 SettingsView 重新挂载，重新拉取 `/profile` 期间会短暂显示"未设置/关闭"的空状态——即用户看到的"信息消失"。

**修复方案（双重保障）**：
- **模块级缓存**：`settings.ts` 新增 `profileCache` + `getCachedProfile/setCachedProfile`。SettingsView 的 `useState` 初始值改用 `getCachedProfile()`，重挂载时秒显上次的 profile，后台再刷新——消除空闪烁。
- **CustomEvent 通知**：子页面保存成功后派发 `echo-profile-updated` 事件，SettingsView 监听该事件并重新 `loadProfile`。即使 SettingsView 当前未挂载，重挂载时也会从缓存秒显 + 自动刷新。
- **路由监听**：`useLocation().pathname` 加入 useEffect 依赖，从子页返回时确保重新拉取最新值。

### 2. MatchPrefsSettings 数据不显示
**修复**：`getProfile()` 增加降级合并逻辑——若 `matchPrefsJson` 缺字段，从 Phase 0 的 `bioJson.identity.matchPreference` 补齐（preferredGender/preferredAgeBand/preferredCity/preferredOccupation），`relationshipIntent` 降级用 `goalOnEcho`。所有消费 `getProfile()` 的地方都受益。

### 3. 隐私模式新增社交边界入口
PrivacySettings 新增"社交边界"导航行（非 toggle，是编辑入口），点击进入 `/settings/boundaries`，显示 `boundariesSummary`（如"3 个禁忌词 · 已设回避话题"）。

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `Echo/src/api/settings.ts` | 新增 SocialBoundaries 类型、profile 缓存、notifyProfileUpdated、getProfile 降级合并、getSocialBoundaries/saveSocialBoundaries 包装、boundariesSummary |
| `Echo/src/features/settings/SettingsView.tsx` | 缓存初始化 + 事件监听 + 路由监听重载 |
| `Echo/src/features/settings/MatchPrefsSettings.tsx` | 保存成功后 notifyProfileUpdated |
| `Echo/src/features/settings/IdentitySettings.tsx` | 保存成功后 notifyProfileUpdated |
| `Echo/src/features/settings/PrivacySettings.tsx` | 并行加载 boundaries、toggle 保存通知、新增社交边界导航行 |
| `Echo/src/features/settings/SocialBoundariesSettings.tsx` | **新建** — 全屏编辑页（forbiddenWords + topicsToAvoid） |
| `Echo/src/App.tsx` | 注册 `/settings/boundaries` 路由 |

## 社交边界设置页（新建）

`SocialBoundariesSettings.tsx` 复用 CloneView 的边界编辑逻辑：
- 加载：`getSocialBoundaries()` → `GET /clones/me` 提取 boundaries
- 编辑：禁忌词 textarea（每行一词，复用 `parseForbiddenWordsInput`）+ 回避话题 textarea
- 保存：`saveSocialBoundaries()` → `PUT /clones/me { boundaries }`，成功后 `notifyProfileUpdated()` + 返回
- dirty 检测控制保存按钮，无改动时禁用
- 无分身时显示友好错误提示

## 验证
- 前端 `tsc --noEmit` 退出码 0（项目 lint 脚本即此命令）
