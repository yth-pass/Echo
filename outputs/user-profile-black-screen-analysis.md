# 广场头像点击 → 用户主页黑屏问题分析

> 日期：2026-07-22
> 触发 commit：`1e32237` feat: UserProfileView 三区块 + 评论/作者头像跳转 + RadarChart

---

## 现象

在广场（Feed）界面点击他人帖子的作者头像后，路由成功跳转到 `/user/:userId`，但页面呈现黑屏，无任何内容显示。

---

## 导航链路验证（正常）

导航链路本身是通的，没有问题：

1. `FeedView.tsx:119-123` — 头像 `<button>` 的 `onClick` 调用 `onOpenProfile(post.authorUserId)`
2. `App.tsx:583` — MainLayout 传入 `onOpenProfile={(userId) => navigate(`/user/${userId}`)}`
3. `App.tsx:443-446` — 路由 `/user/:userId` 已注册，渲染 `UserProfileRoute`
4. `App.tsx:530-541` — `UserProfileRoute` 提取 `userId` 参数，传入 `UserProfileView`
5. `UserProfileView.tsx:68-78` — `useEffect` 调用 `loadPublicProfile(userId)` 发起 `GET /users/:userId/profile`

前端 `mapApiPost`（`api/feed.ts:80-87`）正确地将后端 `author_user_id`（snake_case）映射为 `authorUserId`（camelCase），FeedView 的 `post.authorUserId` 有值时才会触发导航。

**结论：导航本身没问题，黑屏出在目标页面 `UserProfileView` 的渲染阶段。**

---

## 根因：前后端数据契约不同步 + 缺少 ErrorBoundary

### 因因叠加

黑屏是两个问题叠加的结果——单独任何一个都不会导致黑屏。

#### 问题 1：后端未重建，API 返回旧格式（缺字段）

commit `1e32237` 同时改了前端和后端：

| 改动 | 文件 | 内容 |
|------|------|------|
| 前端 | `echo/src/api/notification.ts` | `PublicProfile` 接口新增 `posts: PostPreview[]`、`personaSketch: PersonaSketch \| null`、`idealPartnerSketch: IdealPartnerSketch \| null` |
| 前端 | `echo/src/features/profile/UserProfileView.tsx` | 新增三区块渲染：人格线索（line 177）、理想型 RadarChart（line 206）、广场动态（line 217） |
| 后端 | `services/api/src/profile/profile.service.ts` | `getPublicProfile` 扩展返回 `posts` 数组、`personaSketch`、`idealPartnerSketch` |

**后端从 `dist/` 运行**（`node dist/api/src/main`），源码改动后必须 `nest build` + 重启进程才能生效。如果后端没有重新编译和重启，运行中的 API 仍返回旧格式响应：

```json
// 旧格式（后端未重建时实际返回）
{
  "userId": "...",
  "displayName": "...",
  "avatarUrl": null,
  "city": null,
  "gender": null,
  "interests": [],
  "goalOnEcho": null,
  "postCount": 0
  // ❌ 缺少 posts、personaSketch、idealPartnerSketch
}
```

TypeScript 的 `as PublicProfile` 是编译期断言，不做运行期校验。`unwrap()`（`client.ts:183-185`）直接返回 `r.data`，不补全缺失字段。因此前端拿到的 `profile` 对象中 `profile.posts` 是 `undefined`。

#### 问题 2：`/user/:userId` 路由缺少 ErrorBoundary

`App.tsx` 中三种状态的路由包裹策略不一致：

| `state` | ErrorBoundary 包裹 | 行号 |
|---------|---------------------|------|
| `'auth'` | ✅ 有 | 360-363 |
| `'onboarding'` | ✅ 有 | 369-383 |
| `'main'` | ❌ 无 | 390-475 |

`state === 'main'` 的 `<Routes>` 块直接 return，没有 `<ErrorBoundary>` 包裹。`/user/:userId` 路由（line 443-446）及其所有兄弟路由（`/post/:id`、`/match/:id`、设置页等）都没有错误边界保护。

### 崩溃路径

```
UserProfileView 渲染
  ↓
line 217: {profile.posts.length > 0 && (
  ↓
profile.posts 是 undefined（后端未返回该字段）
  ↓
undefined.length → TypeError: Cannot read properties of undefined (reading 'length')
  ↓
没有 ErrorBoundary 捕获
  ↓
React 卸载整个组件树
  ↓
露出 <body> 背景：#0A0A0A（near-black）
  ↓
用户看到「黑屏」
```

`index.css` 中定义了全局 body 背景色：

```css
/* index.css:10 */
--color-echo-dark: #0A0A0A;

/* index.css:15-16 */
body {
  @apply bg-echo-dark text-gray-100 font-sans antialiased;
}
```

`#0A0A0A` 几乎是纯黑——这就是黑屏的直接来源。

---

## 验证方法

### 快速验证（确认根因）

在浏览器 DevTools Console 中观察是否有以下错误：

```
TypeError: Cannot read properties of undefined (reading 'length')
  at UserProfileView (...)
```

同时在 Network 面板检查 `GET /users/:userId/profile` 的响应 JSON 是否包含 `posts` 字段。如果不包含 → 确认后端未重建。

### 补充验证（如果后端已重建）

如果后端已重建且响应包含 `posts`，检查以下潜在崩溃点：

| 行号 | 代码 | 崩溃条件 |
|------|------|----------|
| 217 | `profile.posts.length > 0` | `posts` 不是数组 |
| 289 | `profile.interests.length > 0` | `interests` 不是数组 |
| 185 | `profile.personaSketch.sections.slice(0, 3)` | `sections` 不是数组（后端仅做 truthy 检查，不验证类型） |
| 192 | `profile.personaSketch.sections.length` | 同上 |
| RadarChart:67 | `dimensions[key]` | `dimensions` 是 undefined/null（后端仅做 truthy 检查） |

后端 `profile.service.ts:121-135` 对 `personaSketch` 和 `idealPartnerSketch` 的校验用的是 JavaScript truthy 判断（`&&`），不验证类型。如果 `bioJson` 中 `sections` 是一个非空字符串（truthy），后端会通过，但前端 `.slice(0,3).map(...)` 会在 `.map()` 处崩溃（字符串没有 `.map()` 方法）。

---

## 涉及文件索引

| 文件 | 行号 | 相关内容 |
|------|------|----------|
| `echo/src/features/profile/UserProfileView.tsx` | 217 | `profile.posts.length` — 主要崩溃点 |
| `echo/src/features/profile/UserProfileView.tsx` | 177-203 | 人格线索区块（新增） |
| `echo/src/features/profile/UserProfileView.tsx` | 206-214 | 理想型区块 + RadarChart（新增） |
| `echo/src/features/profile/UserProfileView.tsx` | 217-264 | 广场动态区块（新增） |
| `echo/src/api/notification.ts` | 113-128 | `PublicProfile` 接口定义（新增三字段） |
| `echo/src/api/client.ts` | 183-185 | `unwrap()` — 不校验数据形状，直接返回 |
| `echo/src/App.tsx` | 390-475 | `state === 'main'` 路由块 — 无 ErrorBoundary |
| `echo/src/App.tsx` | 443-446 | `/user/:userId` 路由定义 |
| `echo/src/index.css` | 10, 15-16 | `--color-echo-dark: #0A0A0A` + body 背景 |
| `echo/src/components/ErrorBoundary.tsx` | 23-73 | ErrorBoundary 组件（存在但未用于 main 路由） |
| `services/api/src/profile/profile.service.ts` | 73-150 | `getPublicProfile` — 新增 posts/persona/ideal 返回 |
| `services/api/src/feed/feed.helper.ts` | 23-35 | `mapPostDto` — 帖子序列化（含 `author_user_id`） |

---

## 修复建议（供参考，本次不做修改）

### 方案 A：重建后端（治本）

```bash
cd services/api
npx nest build
# 查找并杀掉占用 4000 端口的旧进程
netstat -ano | findstr :4000
taskkill /F /PID <旧PID>
# 启动新进程
node dist/api/src/main
```

如果是在生产环境部署，需要重新构建 Docker 镜像：
```bash
cd /opt/echo
docker compose --env-file deploy/.env.production -f deploy/docker-compose.prod.yml up -d --build app
```

### 方案 B：前端加防御性检查（治标 + 健壮性）

在 `UserProfileView.tsx` 中对 `profile.posts`、`profile.interests` 等字段加可选链和默认值：

```tsx
// line 217: 改为
{profile.posts?.length > 0 && (
// line 289: 改为
{profile.interests?.length > 0 && (
// line 185: 改为
profile.personaSketch.sections?.slice?.(0, 3) ?? []
```

### 方案 C：为 main 路由块加 ErrorBoundary（防黑屏兜底）

在 `App.tsx` 的 `state === 'main'` 分支中用 `<ErrorBoundary>` 包裹 `<Routes>`，确保任何子组件崩溃时显示可读的错误信息而非黑屏：

```tsx
// line 390: 改为
return (
  <ErrorBoundary>
    <Routes>
      {/* ... */}
    </Routes>
  </ErrorBoundary>
);
```

**推荐组合**：A + B + C。A 解决根因，B 提升前端健壮性，C 确保即使出现意外崩溃也不会黑屏。
