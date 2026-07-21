# Echo 用户主页信息扩展 + 广场头像跳转改进报告

> **角色**: Senior Developer (高级开发工程师)
> **日期**: 2026-07-21
> **范围**: UserProfileView 三区块扩展（广场动态 / 人格线索 / 理想型 + 雷达图）、PostDetailView 作者头像跳转、评论区头像跳转
> **状态**: 仅审查 + 方案设计，未修改任何代码

---

## 摘要

用户提出两项改进诉求，经代码审查后结论如下：

| # | 诉求 | 审查结论 |
|---|------|---------|
| 1 | 用户主页当前只显示"已发送 / 所在城市 / 广场动态 N 篇"，需补全广场动态详细列表 + 人格线索 + 理想型（含 dimensions 雷达图） | **属实** — 后端 `GET /users/:userId/profile` 仅返回 8 个轻字段（`profile.service.ts:68-107`），未解出 `bioJson.personaSketch` / `bioJson.idealPartnerSketch`，也未返回帖子列表；前端 `UserProfileView` 因此只能渲染三张静态卡片 |
| 2 | 广场中点击其他用户头像能跳转到主页，当前不能点 | **部分属实** — 广场列表 `FeedView.tsx:119-126` 跳转逻辑已存在（最新 commit `1e6ee62` 才加）；但帖子详情页 `PostDetailView.tsx:173-180` 作者头像 + 评论头像（210-211、265-266 行）均为纯 `<img>` 无 onClick，确实不能点 |

关于 dimensions 展示形式：用户明确要求**雷达图**呈现 `emotionalSafety / spaceRespect / directCommunication / conflictResolution` 四维（值域 -1 ~ +1）。项目当前零图表库，但有手写 SVG 先例（`ProgressRing.tsx`）与同构数据契约的条形图（`DimensionBars.tsx`），将仿照手写 SVG 模式新建零依赖 `RadarChart` 组件。

---

## 一、当前现状审查

### 1.1 用户主页（UserProfileView）信息缺口

#### 关键文件

- `echo/src/features/profile/UserProfileView.tsx` — 主页组件（205 行）
- `echo/src/api/notification.ts:83-96` — `PublicProfile` 类型 + `loadPublicProfile` 实现
- `services/api/src/profile/profile.controller.ts:23-27` — `GET /users/:userId/profile` 路由
- `services/api/src/profile/profile.service.ts:68-107` — `getPublicProfile` 后端实现
- `services/api/src/onboarding/survey-schema.ts:140-155` — `IdealPartnerSketch` 类型定义
- `services/api/src/clones/clones.service.ts:153-178` — 已有的 personaSketch / idealPartnerSketch 解析逻辑（可复用）
- `services/api/src/feed/feed.service.ts:28-55, 194-236` — 已有的帖子 `findMany` + `mapPost` 模式（可复用）

#### 后端返回字段现状

`profile.service.ts:68-107` 的 `getPublicProfile` 当前 select 了 `displayName / avatarUrl / city / gender / bioJson`，但解析 `bioJson` 时只提取了 `interests` 和 `goalOnEcho`：

```ts
// profile.service.ts:92-95
const bioJson = profile.bioJson as Record<string, unknown> | null;
const interests = Array.isArray(bioJson?.interests) ? bioJson!.interests : [];
const goalOnEcho = typeof bioJson?.goalOnEcho === 'string' ? bioJson.goalOnEcho : null;

return {
  userId: targetUserId,
  displayName: profile.displayName ?? '分身',
  avatarUrl: profile.avatarUrl ?? null,
  city: profile.city ?? null,
  gender: profile.gender ?? null,
  interests,
  goalOnEcho,
  postCount,            // ← 仅数字，不返帖子列表
};
```

**未解出**：`bioJson.personaSketch`（含 `narrative` + 7 段 `sections`）、`bioJson.idealPartnerSketch`（含 `narrative` + 4 维 `dimensions`）。

**未查询**：该用户发过的帖子列表（仅 `prisma.post.count` 取了数字，未 `findMany`）。

#### 数据其实齐备

`Profile.bioJson` 在 Onboarding 流程中已写入完整的 personaSketch 和 idealPartnerSketch（来源：`persona-sketch.service.ts` + `ideal-partner-sketch.service.ts`，落库到 `Profile.bioJson`）。后端 `GET /clones/me` 已能完整返回给"自己"看（`clones.service.ts:153-178`）：

```ts
// clones.service.ts:163-178 (节选)
const personaSketch: PersonaSketchResponse | null =
  bio.personaSketch?.narrative && bio.personaSketch.sections
    ? { narrative: bio.personaSketch.narrative, sections: bio.personaSketch.sections }
    : null;

const idealPartnerSketch: IdealPartnerSketch | null =
  bio.idealPartnerSketch?.narrative && bio.idealPartnerSketch.dimensions
    ? { narrative: bio.idealPartnerSketch.narrative, dimensions: bio.idealPartnerSketch.dimensions }
    : null;
```

**这段解析逻辑可零改造复用到 `getPublicProfile`**——同一份数据源、同一份 shape，只是出口不同（一个给自己看，一个给陌生人看）。

帖子列表查询模式 `feed.service.ts:28-55` 已经跑通（含拉黑过滤、cursor 分页、`mapPost` 序列化），同样可仿照。

#### 前端 UserProfileView 渲染现状

`UserProfileView.tsx` 第 135-185 行渲染了 4 张卡片：

| 卡片 | 数据来源 | 是否完整 |
|------|---------|---------|
| 所在城市 | `profile.city` | ✓ |
| 来 Echo 的目的 | `profile.goalOnEcho` | ✓ |
| 广场动态 | `profile.postCount`（仅数字） | ✗ 缺帖子列表 |
| 兴趣爱好 | `profile.interests` | ✓ |
| **人格线索** | — | ✗ 完全缺 |
| **理想伴侣** | — | ✗ 完全缺 |

用户反馈"主页只显示 已发送 / 所在城市 / 广场动态 1 篇"——**完全属实**。

### 1.2 广场头像跳转能力现状

#### 广场列表页 `FeedView.tsx`（跳转已存在）

最新 commit `1e6ee62`（"fix: add all uncommitted source files + fix nginx Dockerfile echo/ casing"）刚把头像从纯 `<img>` 改成 `<button>` 包裹：

```tsx
// FeedView.tsx:117-133
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    if (post.authorUserId && onOpenProfile) {
      onOpenProfile(post.authorUserId);
    }
  }}
  className="shrink-0 rounded-full"
>
  {post.authorAvatarUrl ? (
    <img src={post.authorAvatarUrl} alt={post.author} className="w-8 h-8 rounded-full object-cover" />
  ) : (
    <div className="..."> <Fingerprint ... /> </div>
  )}
</button>
```

路由透传链路完整：

- `App.tsx:566` — `onOpenProfile={(userId) => navigate(\`/user/${userId}\`)}`
- `App.tsx:444-446` — 路由 `/user/:userId` 定义 → `UserProfileRoute`
- `App.tsx:522-524` — `UserProfileRoute` 解析 `useParams` 后渲染 `UserProfileView`

数据链路同样完整：

| 环节 | 字段名 | 文件:行 |
|---|---|---|
| 后端数据源 | `p.clone.userId` | `feed.service.ts:226` |
| 后端列表/详情返回 | `author_user_id` (snake) | `feed.service.ts:226, 138-140` |
| 前端 API 映射 | `row.author_user_id` → `authorUserId` | `echo/src/api/feed.ts:78-79, 85` |
| 前端类型 | `authorUserId?: string \| null` | `echo/src/types.ts:15` |
| 前端消费 | `post.authorUserId`（强类型，非 any） | `FeedView.tsx:121-122` |

**广场列表页跳转逻辑、数据、路由全部就绪。** 用户反馈"广场中不能点"如果不是指广场列表本身，那就指向**帖子详情页**——见下。

#### 帖子详情页 `PostDetailView.tsx`（跳转完全缺失）

帖子作者头像第 173-180 行：

```tsx
{display.authorAvatarUrl ? (
  <img
    src={display.authorAvatarUrl}
    alt={display.author}
    className="w-10 h-10 rounded-full object-cover"
  />
) : (
  <div className="..."> <Fingerprint ... /> </div>
)}
```

**纯 `<img>` 渲染，外层无 `<button>`、无 onClick。** 数据层 `display.authorUserId` 已经通过 `loadPostDetail` → `mapApiPost`（`feed.ts:78-85`）拿到，但 UI 层没有把它接到导航上。

评论区头像第 210-211、265-266 行同样是纯 `<img>`。

git 历史：`PostDetailView.tsx` 从 P1-05（`da0b001`）起就是纯 `<img>`，从没加过跳转逻辑。

#### 评论区头像跳转的数据缺口（比作者头像大）

要让评论区头像也能跳转，需要补 4 处：

| 层级 | 现状 | 需要补 |
|------|------|--------|
| DB schema (Comment) | 只有 `cloneId`，无直接 `userId` | 不改 schema，通过 `comment.clone.userId` 关联取 |
| 后端评论序列化（`feed.service.ts:144-186`） | 缺 `author_user_id`，但 Prisma 已 `include: { user: { include: { profile: true } } }` 加载了 user 数据 | 序列化时加 `author_user_id: c.clone.userId`（数据已加载，只是没输出） |
| 前端 `CommentItem` 类型（`feed.ts:17-28`） | 无 `author_user_id` 字段 | 加 `author_user_id?: string \| null` |
| 前端 `parseComments`（`feed.ts:128-145`） | 不解析 user id | 加一行 `author_user_id: typeof row.author_user_id === 'string' ? row.author_user_id : null` |
| PostDetailView 评论区头像（`PostDetailView.tsx:210, 265`） | 纯 `<img>` 无 onClick | 包 `<button>` + 调 `onOpenProfile` |

**对比**：帖子级别（`mapPost`）已经有 `author_user_id` 且前端已消费，评论侧只是遗漏了——同一个项目里已有先例可循。

### 1.3 雷达图可视化基础设施

项目 `package.json` **未安装任何图表库**（recharts / chart.js / d3 / visx / nio / echarts / tremor 全无）。

`echo/src` 全量搜索 `[Rr]adar` 关键词，**0 个匹配**。

当前理想型 4 维数据的可视化方式：`echo/src/features/onboarding/v2/components/DimensionBars.tsx`，是水平条形图（4 条水平进度条），数据契约 `IdealPartnerSketchDimensions` 与目标四维完全一致，映射公式 `percent = Math.round(((value + 1) / 2) * 100)`。组件位置：Onboarding Phase 1.6 `Phase1_6IdealSketch.tsx:133`。

项目已有手写 SVG 先例：`echo/src/features/onboarding/v2/components/ProgressRing.tsx` 用 `<svg><circle strokeDasharray...>` 做圆环进度，配合 `transition-all duration-500` 做动画。雷达图（`<polygon>` 描点 + `<line>` 坐标轴）可完全仿照此模式手写，配合 `motion/react` 做入场形变动画。

#### 用户反馈验证

✅ **完全属实**。所有诉求与代码现状一一对应，没有误解。

---

## 二、改进后的用户体验变化

### 2.1 用户主页：从"名片"升级为"立体人物画像"

**当前**：进入其他用户主页，只看到头像 + 昵称 + 所在城市 + 来 Echo 的目的 + 广场动态篇数（一个数字）+ 兴趣标签 + 发起匹配按钮。三张静态卡片，信息密度低，无法判断"这个人是谁"。

**改进后**：主页从上到下依次呈现五个区块——

```
┌─────────────────────────────────────┐
│        [头像 80x80]                  │
│        昵称                          │
│        [发起匹配 按钮]                │
├─────────────────────────────────────┤
│  📍 所在城市：深圳                   │  ← 保留
│  💬 来 Echo 的目的：…                │  ← 保留
│  ✨ 兴趣爱好：[音乐][电影][徒步]     │  ← 保留
├─────────────────────────────────────┤
│  ▌广场动态 (3 篇)                    │  ← 新增
│  ┌─────────────────────────────────┐│
│  │ [头像] author · 2小时前          ││
│  │ 帖子正文预览（前 80 字）…        ││
│  │ 查看全文 →                       ││
│  │ ❤ 12  💬 3                       ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ [更多帖子，至多 5 条]            ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  ▌人格线索                           │  ← 新增
│  ┌─────────────────────────────────┐│
│  │ 你是一个在热闹饭局上反而           ││
│  │ 显得安静的人，但回到小圈子…       ││  ← narrative
│  │                                  ││
│  │ ◆ 身份叙事                       ││
│  │   在家人面前是稳重长子…           ││  ← sections[0]
│  │ ◆ 性格纹理                       ││
│  │   偏好用行动而非言辞表达…         ││  ← sections[1]
│  │ …（共 7 段）                     ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  ▌理想伴侣                           │  ← 新增
│  ┌─────────────────────────────────┐│
│  │ 你需要的是一个每天忙到很晚         ││
│  │ 也会给你发一句"到家了"的人…        ││  ← narrative
│  │                                  ││
│  │  [雷达图 SVG]                    ││  ← dimensions 可视化
│  │   情感安全 ●───── 0.6            ││
│  │   独立空间 ●── 0.2              ││
│  │   直接沟通 ●─────── 0.8          ││
│  │   冲突处理 ●─── 0.4              ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

- **广场动态列表**：复用 `FeedView` 的帖子卡片样式（`<motion.button>` + `onClick={() => onOpenPost(post.id)}`），每条显示头像 + 作者 + 时间 + 正文预览（80 字截断）+ 点赞数 + 评论数，点击进入 `PostDetailView`
- **人格线索**：先展示一段 200-400 字的 `narrative` 叙事散文，再按 7 个 `sections` 渲染成"标题 + 段落"的卡片堆叠（identityNarrative / personalityTexture / coreBeliefs / valuesInAction / caringStyle / socialBoundaries / contradictions + voiceAnchors 锚点列表）
- **理想伴侣**：展示 `narrative` + 雷达图（4 维 polygon + 数值标签）。**dimensions 完整对陌生人开放**（用户已确认），雷达图比纯数字直观、比条形图立体

**用户使用变化**：

- 陌生人在决定是否发起匹配前，可从"作品—性格—期待"三层判断对方是谁，而不是只看一个数字和几个兴趣 tag
- personaSketch 的叙事性人物小传本身就是 LLM 用于"扮演"该用户的素材，把它展示给陌生人完全符合 Echo"分身代替你社交"的产品语义
- 雷达图让 4 维冲突/匹配需求一目了然——比如"高情感安全 + 高直接沟通"的用户能立刻看出，避免 mismatch
- 主页内的帖子卡片可点击进入 PostDetailView，再点该作者头像又回主页，形成"广场 → 主页 → 帖子 → 主页"的浏览闭环

### 2.2 帖子详情页：作者头像可跳转

**当前**：进入 PostDetailView，作者头像（第 173 行）是纯展示，不能点。用户看完帖子想了解作者，需要退回广场列表再找该用户的其它帖子。

**改进后**：作者头像外层包 `<button>`，点击跳转到 `/user/{authorUserId}`。视觉上保持圆形头像样式不变，hover 时有轻微缩放（`hover:scale-[1.05]`）暗示可点。

**用户使用变化**：广场点别人头像 → 主页 → 主页里点该作者帖子 → PostDetailView → 点作者头像 → 回主页。完整的浏览闭环，无需退回列表页。

### 2.3 评论区头像也可跳转

**当前**：评论作者头像（顶层评论 + 回复两层）都是纯 `<img>`，不能点。看到一条精彩评论想了解评论者，做不到。

**改进后**：评论头像同样包 `<button>`，点击跳转到该评论者的 `/user/{authorUserId}`。评论区从"只读名片"升级为"可探索的社交节点"。

---

## 三、实现路径

### 3.1 后端：扩展 `GET /users/:userId/profile` 返回字段

**文件**：`services/api/src/profile/profile.service.ts:68-107`

`getPublicProfile` 改造点：

1. **复用 `clones.service.ts:153-178` 的解析逻辑**：从 `bioJson` 解出 `personaSketch`（`{ narrative, sections }`）和 `idealPartnerSketch`（`{ narrative, dimensions }`），shape 与 `GET /clones/me` 完全一致
2. **新增帖子列表查询**：仿 `feed.service.ts:28-55` 的 `findMany` 模式，查该用户 clone 下 `moderationStatus: 'approved'` 的帖子，按 `createdAt desc` 取前 N 条（建议 5 条预览 + 总数保留 `postCount`）
3. **复用 `feed.service.ts:194-236` 的 `mapPost`**：把当前 private `mapPost` 抽成 internal 或 FeedHelper，保证 `authorAvatarUrl / author / authorUserId / likes / comments` 字段一致
4. **应用当前用户的拉黑过滤（服务端兜底，必须实现）**：注入 `BlockFilterService`，在方法开头调 `getBlockedUserIds(currentUserId)`，若 `targetUserId ∈ blockedIds` 直接抛 `ForbiddenException`（403）。防止"前端不展示但用户绕过前端直接访问 `/user/{A.userId}`"的窥视场景，保护 personaSketch / idealPartnerSketch 等深度画像不泄露给被拉黑者

返回结构在现有 `PublicProfile` 上扩展：

```ts
{
  // 原有字段不变
  userId, displayName, avatarUrl, city, gender, interests, goalOnEcho, postCount,
  // 新增
  posts: Post[],   // 前 5 条预览
  personaSketch: { narrative: string; sections: { key: string; title: string; narrative: string }[] } | null,
  idealPartnerSketch: { narrative: string; dimensions: { emotionalSafety: number; spaceRespect: number; directCommunication: number; conflictResolution: number } } | null,
}
```

`profile.controller.ts:23-27` 的路由签名不动，仅 service 层扩展。

### 3.2 前端：扩展 `PublicProfile` 接口类型

**文件**：`echo/src/api/notification.ts:83-96`

```ts
export interface PublicProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
  gender: string | null;
  interests: string[];
  goalOnEcho: string | null;
  postCount: number;
  // 新增
  posts: Post[];   // 复用 echo/src/types.ts 的 Post 类型
  personaSketch: {
    narrative: string;
    sections: { key: string; title: string; narrative: string }[];
  } | null;
  idealPartnerSketch: {
    narrative: string;
    dimensions: {
      emotionalSafety: number;
      spaceRespect: number;
      directCommunication: number;
      conflictResolution: number;
    };
  } | null;
}
```

`loadPublicProfile` 函数（`notification.ts:94-96`）不需要改——它已经是 `unwrap(await apiGetJson<PublicProfile>(...))`，类型扩展后自动生效。

### 3.3 新建 `RadarChart` 组件（零依赖手写 SVG）

**文件（新建）**：`echo/src/components/RadarChart.tsx`

仿 `ProgressRing.tsx` 的手写 SVG 模式，用 `<polygon>` 描点 + `<line>` 坐标轴 + `motion/react` 入场形变动画：

- Props：`dimensions: { emotionalSafety: number; spaceRespect: number; directCommunication: number; conflictResolution: number }`，值域 -1 ~ +1
- 内部映射：每个维度 `r = ((value + 1) / 2) * maxRadius`，把 -1~+1 映射到 0~maxRadius
- 4 个轴按 90° 等分（4 维雷达图是菱形/正方形变形）
- 背景：4 层同心多边形（25% / 50% / 75% 100%）作刻度
- 数据多边形：`motion.polygon` 用 `initial={{ scale: 0 }} animate={{ scale: 1 }}` 做入场形变
- 标签：4 个维度中文名 + 数值显示

数据契约与 `DimensionBars.tsx` 完全同构（同样消费 `IdealPartnerSketchDimensions`），仅在渲染层换 shape。

### 3.4 `UserProfileView` 增加三区块

**文件**：`echo/src/features/profile/UserProfileView.tsx`

在现有"兴趣爱好"卡片（第 169-184 行）之后插入三个新区块：

#### 3.4.1 广场动态列表区块

复用 `FeedView` 的帖子卡片样式（`<motion.button onClick={() => onOpenPost(post.id)}>` + 头像 + 作者 + 时间 + 预览 + 点赞/评论数）。需要：

- `UserProfileView` 新增 prop：`onOpenPost: (postId: string) => void`
- `App.tsx:522-524` 的 `UserProfileRoute` 加 `onOpenPost` 透传：`onOpenPost={(id) => navigate(\`/post/${id}\`)}`
- `App.tsx:444-446` 的 Route element 加该 prop

#### 3.4.2 人格线索区块

展示 `personaSketch.narrative`（200-400 字段落）+ `sections` 数组（按 key 映射中文标题，仿 `clones.service.ts:54-63` 的 `PERSONA_SKETCH_SECTION_TITLES`）。

每个 section 渲染为"标题 + 叙事段落"卡片，堆叠展示。**不要把维度分数显示出来**（按 memory 里"叙事优于维度分数"的设计哲学，persona 不存维度分数，本来就没有）。

#### 3.4.3 理想伴侣区块

展示 `idealPartnerSketch.narrative` + `<RadarChart dimensions={idealPartnerSketch.dimensions} />`。

**注意**：用户已明确要展示 dimensions 雷达图，不隐藏。

### 3.5 `PostDetailView` 帖子作者头像跳转

**文件**：`echo/src/features/feed/PostDetailView.tsx:173-180`

把纯 `<img>` 用 `<button>` 包裹，仿 `FeedView.tsx:119-126` 的写法：

```tsx
<button
  type="button"
  onClick={() => display.authorUserId && onOpenProfile(display.authorUserId)}
  className="shrink-0 rounded-full transition-transform hover:scale-[1.05]"
>
  {display.authorAvatarUrl ? (
    <img src={display.authorAvatarUrl} alt={display.author} className="w-10 h-10 rounded-full object-cover" />
  ) : (
    <div className="..."> <Fingerprint ... /> </div>
  )}
</button>
```

`PostDetailView` 当前 props 没有 `onOpenProfile`，需要：

1. 组件 props 加 `onOpenProfile?: (userId: string) => void`
2. `App.tsx:493-498` 的 `PostRoute` 透传：`onOpenProfile={(userId) => navigate(\`/user/${userId}\`)}`
3. `App.tsx:391-396` 的 Route element 加该 prop

### 3.6 评论区头像跳转（含后端字段补齐）

#### 3.6.1 后端评论序列化补 `author_user_id`

**文件**：`services/api/src/feed/feed.service.ts:144-186`

顶层评论序列化（约 146-163 行）加一行：

```ts
author_user_id: c.clone.userId,   // ← 新增（数据已 include 加载，只是没输出）
```

回复序列化（约 166-184 行）同样加：

```ts
author_user_id: r.clone.userId,
```

`getOne` 的 Prisma 查询（`feed.service.ts:104` 附近）已 `include: { user: { include: { profile: true } } }`，**无需改查询**，仅序列化输出加字段。

#### 3.6.2 前端 `CommentItem` 类型扩展

**文件**：`echo/src/api/feed.ts:17-28`

```ts
export type CommentItem = {
  id: string;
  content: string;
  author: string;
  author_avatar: string | null;
  author_user_id?: string | null;   // ← 新增
  created_at: string;
  parent_id: string | null;
  clone_id: string;
  likes: number;
  liked: boolean;
  replies?: CommentItem[];
};
```

#### 3.6.3 前端 `parseComments` 解析扩展

**文件**：`echo/src/api/feed.ts:128-145`

```ts
// 在每条 comment 映射时加：
author_user_id: typeof row.author_user_id === 'string' ? row.author_user_id : null,
```

#### 3.6.4 PostDetailView 评论区头像渲染

**文件**：`echo/src/features/feed/PostDetailView.tsx:210-211, 265-266`

顶层评论头像（约 210 行）和回复头像（约 265 行）同样用 `<button>` 包裹：

```tsx
<button
  type="button"
  onClick={() => comment.author_user_id && onOpenProfile(comment.author_user_id)}
  className="shrink-0 rounded-full transition-transform hover:scale-[1.05]"
>
  {comment.author_avatar ? (
    <img src={comment.author_avatar} alt={comment.author} className="w-8 h-8 rounded-full object-cover" />
  ) : (
    <div className="..."> <Fingerprint ... /> </div>
  )}
</button>
```

`PostDetailView` 已经在第 3.5 步加了 `onOpenProfile` prop，评论区头像直接复用。

---

## 四、实现计划（分阶段）

按"先底层 → 再 UI → 最后补评论侧"顺序，每阶段独立可验证、可回滚：

### 阶段 A：后端公开资料接口扩展

**目标**：`GET /users/:userId/profile` 返回完整字段（posts + personaSketch + idealPartnerSketch）。

**改动文件**（共 3 个）:
1. `services/api/src/profile/profile.service.ts` — `getPublicProfile` 扩展（含拉黑兜底 + 帖子查询 + persona/ideal 解析）
2. `services/api/src/profile/profile.module.ts` — 注入 `BlockFilterService`（若 Module 未导入）
3. `services/api/src/feed/feed.service.ts` — 把 private `mapPost` 抽成可被其他 service 复用的方法（或抽到 `feed.helper.ts`）

#### 步骤 A1：抽离 `mapPost` 为可复用 helper

文件：`services/api/src/feed/feed.service.ts:194-236`

把 `private mapPost(p: ...): PostDto` 抽成 `export function mapPostDto(p: ...): PostDto`（独立文件 `feed.helper.ts` 或同文件 export）。`feed.service.ts` 的 `list` 和 `getOne` 内部调用从 `this.mapPost` 改成 `mapPostDto`。

```ts
// feed.helper.ts（新建）
import type { Prisma } from '@prisma/client';

type PostWithRelations = Prisma.PostGetPayload<{
  include: {
    clone: { include: { user: { include: { profile: true } } } };
    _count: { select: { likes: true; comments: true } };
  };
}>;

export function mapPostDto(p: PostWithRelations) {
  return {
    id: p.id,
    clone_id: p.cloneId,
    author: p.clone.user.profile?.displayName ?? '分身',
    author_display: p.clone.user.profile?.displayName ?? '分身',
    author_avatar: p.clone.user.profile?.avatarUrl ?? null,
    author_user_id: p.clone.userId,    // 关键：保留 user id
    content: p.content,
    created_at: p.createdAt.toISOString(),
    likes: p._count.likes,
    comments: p._count.comments,
  };
}
```

#### 步骤 A2：`getPublicProfile` 扩展查询帖子列表

文件：`services/api/src/profile/profile.service.ts:68-107`

**A2.1 在 constructor 注入 BlockFilterService**（仿 `feed.service.ts` 已有先例）：

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly blockFilter: BlockFilterService,
  // ...其他已有依赖
) {}
```

若 `profile.module.ts` 未导入 `BlockFilterModule`，需在 imports 数组里加上（`block-filter.module.ts` 同其他 service 已共享此模块）。

**A2.2 改造 `getPublicProfile` 方法**：

```ts
async getPublicProfile(targetUserId: string, currentUserId?: string) {
  // 拉黑兜底：若当前用户与目标用户存在双向拉黑关系，直接拒绝访问
  // 防止 B 通过直接输入 URL /user/{A.userId} 绕过前端拉黑限制窥视 A 的深度画像
  if (currentUserId) {
    const blockedIds = await this.blockFilter.getBlockedUserIds(currentUserId);
    if (blockedIds.includes(targetUserId)) {
      throw new ForbiddenException('无法查看该用户主页');
    }
  }

  const profile = await this.prisma.profile.findUnique({
    where: { userId: targetUserId },
    select: { displayName: true, avatarUrl: true, city: true, gender: true, bioJson: true },
  });
  if (!profile) throw new NotFoundException('User not found');

  const clone = await this.prisma.digitalClone.findUnique({
    where: { userId: targetUserId },
  });

  // 帖子总数 + 前 5 条预览
  let postCount = 0;
  let posts: ReturnType<typeof mapPostDto>[] = [];
  if (clone) {
    postCount = await this.prisma.post.count({
      where: { cloneId: clone.id, moderationStatus: 'approved' },
    });
    const rawPosts = await this.prisma.post.findMany({
      where: { cloneId: clone.id, moderationStatus: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        clone: { include: { user: { include: { profile: true } } } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    posts = rawPosts.map(mapPostDto);
  }

  // 解析 bioJson（复用 clones.service.ts:153-178 的逻辑）
  const bioJson = profile.bioJson as Record<string, unknown> | null;
  const interests = Array.isArray(bioJson?.interests) ? bioJson!.interests : [];
  const goalOnEcho = typeof bioJson?.goalOnEcho === 'string' ? bioJson.goalOnEcho : null;

  const personaSketch =
    bioJson?.personaSketch && (bioJson.personaSketch as any).narrative && (bioJson.personaSketch as any).sections
      ? {
          narrative: (bioJson.personaSketch as any).narrative,
          sections: (bioJson.personaSketch as any).sections,
        }
      : null;

  const idealPartnerSketch =
    bioJson?.idealPartnerSketch && (bioJson.idealPartnerSketch as any).narrative && (bioJson.idealPartnerSketch as any).dimensions
      ? {
          narrative: (bioJson.idealPartnerSketch as any).narrative,
          dimensions: (bioJson.idealPartnerSketch as any).dimensions,
        }
      : null;

  return {
    userId: targetUserId,
    displayName: profile.displayName ?? '分身',
    avatarUrl: profile.avatarUrl ?? null,
    city: profile.city ?? null,
    gender: profile.gender ?? null,
    interests,
    goalOnEcho,
    postCount,
    posts,                  // ← 新增
    personaSketch,          // ← 新增
    idealPartnerSketch,     // ← 新增
  };
}
```

> **拉黑兜底语义**：`getBlockedUserIds` 返回双向拉黑列表（A 拉黑 B + B 拉黑 A 都算）。任一方向命中即拒绝，避免单向拉黑时仍允许对方窥视。403 而非 404：与"该用户不存在"的视觉表现一致（前端 `loadPublicProfile` 走 `!res.ok` 分支显示"无法加载用户资料"），不暴露 A 的存在性。

#### 步骤 A3：controller 透传 currentUserId（用于拉黑过滤）

文件：`services/api/src/profile/profile.controller.ts:23-27`

```ts
@Get('users/:userId/profile')
async getPublicProfile(
  @CurrentUser() userId: string,
  @Param('userId') targetUserId: string,
) {
  return this.profileService.getPublicProfile(targetUserId, userId);
}
```

> **拉黑过滤策略（已纳入阶段 A）**：本次实现服务端兜底。`A2.1` 步骤注入 `BlockFilterService`，`A2.2` 步骤方法开头做早期 403 检查。前端 UserProfileView 在 `loadPublicProfile` 返回 null（403 触发 `!res.ok`）时显示"无法加载用户资料"——与"该用户不存在"视觉一致，不暴露被拉黑者的存在性。前端 FeedView 拉黑后不展示对方头像仍然保留作为第一道防线（产品语义层面），服务端兜底是第二道防线（安全层面）。

#### 验证步骤

1. `cd services/api && npm run build` 通过
2. `curl http://localhost:4000/v1/users/<otherUserId>/profile -H "Authorization: Bearer <jwt>"` 返回结构包含 `posts / personaSketch / idealPartnerSketch`
3. 测试目标用户无 Onboarding（无 personaSketch）→ 返回 `personaSketch: null`，前端兜底渲染"该用户尚未完成人格画像"
4. **拉黑兜底测试**：让 A 拉黑 B → B 持 token 请求 `/v1/users/{A.userId}/profile` → 返回 403 `无法查看该用户主页`；前端 `loadPublicProfile` 走 `!res.ok` 分支返回 null，UserProfileView 显示"无法加载用户资料"
5. **反向拉黑测试**：让 B 拉黑 A → 同上结果（双向拉黑任一方向命中即拒绝，避免单向拉黑时仍允许对方窥视）
6. **未拉黑对照**：A 和 B 无拉黑关系 → 正常返回 A 的完整资料

**改动行数**：~65 行（含 BlockFilter 注入 + 403 早期检查 + 帖子查询 + persona/ideal 解析）
**风险**：低（仅扩展返回字段 + 早期 403 守卫，不改既有字段语义；拉黑兜底走与 feed.service.ts 相同的 BlockFilter 路径，已验证模式）
**回滚**：`git revert` 单次 commit
**预计工时**：1.5-2 小时

### 阶段 B：前端 `PublicProfile` 类型扩展

**目标**：前端类型层承认新增字段，为 UI 渲染做准备。

**改动文件**（共 1 个）:
1. `echo/src/api/notification.ts:83-96` — 扩展 `PublicProfile` 接口

#### 步骤 B1：扩展接口

文件：`echo/src/api/notification.ts`

```ts
import type { Post } from '../types';

export interface PublicProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  city: string | null;
  gender: string | null;
  interests: string[];
  goalOnEcho: string | null;
  postCount: number;
  // 新增 ↓
  posts: Post[];
  personaSketch: {
    narrative: string;
    sections: { key: string; title: string; narrative: string }[];
  } | null;
  idealPartnerSketch: {
    narrative: string;
    dimensions: {
      emotionalSafety: number;
      spaceRespect: number;
      directCommunication: number;
      conflictResolution: number;
    };
  } | null;
}
```

`loadPublicProfile`（94-96 行）不动。

#### 验证步骤

1. `cd echo && npx tsc --noEmit` 通过（确认类型扩展不破现有调用）
2. `loadPublicProfile` 调用仍正常返回（运行时字段缺失时为 `undefined`，前端组件用 `?? null` 兜底）

**改动行数**：~20 行
**风险**：极低（纯类型扩展）
**回滚**：`git revert` 单次 commit
**预计工时**：15 分钟

### 阶段 C：新建 `RadarChart` 组件（零依赖手写 SVG）

**目标**：可复用的雷达图组件，输入 4 维 -1~+1 数值，输出带入场动画的 SVG 雷达图。

**改动文件**（共 1 个新建）:
1. `echo/src/components/RadarChart.tsx` — 新建

#### 步骤 C1：实现 RadarChart

文件：`echo/src/components/RadarChart.tsx`（新建）

```tsx
import { motion } from 'motion/react';

interface RadarChartDimensions {
  emotionalSafety: number;       // -1 ~ +1
  spaceRespect: number;
  directCommunication: number;
  conflictResolution: number;
}

interface RadarChartProps {
  dimensions: RadarChartDimensions;
  size?: number;        // SVG 边长，默认 200
}

const LABELS: { key: keyof RadarChartDimensions; label: string }[] = [
  { key: 'emotionalSafety',    label: '情感安全' },
  { key: 'spaceRespect',       label: '独立空间' },
  { key: 'directCommunication', label: '直接沟通' },
  { key: 'conflictResolution', label: '冲突处理' },
];

export function RadarChart({ dimensions, size = 200 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.35;
  const labelRadius = maxRadius + 18;

  // 4 个轴：从正上方开始顺时针，每 90°
  const angles = LABELS.map((_, i) => (Math.PI * 2 * i) / 4 - Math.PI / 2);

  // 把 -1~+1 映射到 0~maxRadius
  const valueToRadius = (v: number) => ((v + 1) / 2) * maxRadius;

  // 数据点坐标
  const dataPoints = LABELS.map((item, i) => {
    const r = valueToRadius(dimensions[item.key]);
    return {
      x: cx + Math.cos(angles[i]) * r,
      y: cy + Math.sin(angles[i]) * r,
    };
  });
  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  // 4 层刻度（25/50/75/100%）
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  // 标签坐标
  const labelPoints = LABELS.map((_, i) => ({
    x: cx + Math.cos(angles[i]) * labelRadius,
    y: cy + Math.sin(angles[i]) * labelRadius,
  }));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* 背景刻度环 */}
      {gridLevels.map(level => {
        const r = maxRadius * level;
        const pts = angles.map(a => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`).join(' ');
        return (
          <polygon
            key={level}
            points={pts}
            fill="none"
            stroke="#d9e3f4"
            strokeWidth={1}
          />
        );
      })}

      {/* 坐标轴线 */}
      {angles.map((a, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + Math.cos(a) * maxRadius}
          y2={cy + Math.sin(a) * maxRadius}
          stroke="#d9e3f4"
          strokeWidth={1}
        />
      ))}

      {/* 数据多边形（带入场形变） */}
      <motion.polygon
        points={dataPolygon}
        fill="rgba(43,138,239,0.18)"
        stroke="#2B8AEF"
        strokeWidth={2}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />

      {/* 数据点 */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#2B8AEF" />
      ))}

      {/* 维度标签 + 数值 */}
      {labelPoints.map((p, i) => {
        const item = LABELS[i];
        const value = dimensions[item.key];
        const sign = value > 0 ? '+' : '';
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[10px]"
            fill="#4a4455"
          >
            <tspan x={p.x} dy="-0.4em" fontWeight="600">{item.label}</tspan>
            <tspan x={p.x} dy="1.2em" fill="#7b7487">{sign}{value.toFixed(2)}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
```

#### 验证步骤

1. `npx tsc --noEmit` 通过
2. 临时在 UserProfileView 顶部 import 并用假数据渲染：
   ```tsx
   <RadarChart dimensions={{ emotionalSafety: 0.6, spaceRespect: 0.2, directCommunication: 0.8, conflictResolution: 0.4 }} />
   ```
3. 浏览器查看 SVG 雷达图，4 层刻度 + 数据多边形 + 标签 + 数值正确渲染，入场形变动画顺畅
4. 测试边界值：所有维度 = -1（点全部在中心） / +1（点全部在最外圈） / 0（点在中间圈）

**改动行数**：~100 行
**风险**：极低（独立组件，不影响其他代码）
**回滚**：删除文件
**预计工时**：45-60 分钟

### 阶段 D：UserProfileView 三区块 UI

**目标**：用户主页展示广场动态列表 + 人格线索 + 理想伴侣（含雷达图）三区块。

**改动文件**（共 2 个）:
1. `echo/src/features/profile/UserProfileView.tsx` — 新增三区块渲染
2. `echo/src/App.tsx:444-446, 522-524` — `UserProfileRoute` 加 `onOpenPost` 透传

#### 步骤 D1：UserProfileView 接收 onOpenPost prop

文件：`echo/src/features/profile/UserProfileView.tsx:11-19`

```tsx
export function UserProfileView({
  userId,
  currentUserId,
  onBack,
  onOpenPost,   // ← 新增
}: {
  userId: string;
  currentUserId: string;
  onBack: () => void;
  onOpenPost: (postId: string) => void;   // ← 新增
}) {
```

#### 步骤 D2：在"兴趣爱好"卡片后插入三区块

文件：`echo/src/features/profile/UserProfileView.tsx`，第 184 行后（`</div>` 闭合"Interests"卡片后）插入：

```tsx
{/* 广场动态列表 */}
{profile.posts.length > 0 && (
  <div className="mt-6">
    <h3 className="text-xs font-bold uppercase mb-3" style={{ color: '#7b7487' }}>
      广场动态 ({profile.postCount})
    </h3>
    <div className="space-y-3">
      {profile.posts.map((post) => (
        <motion.button
          key={post.id}
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onOpenPost(post.id)}
          className="w-full text-left p-4 rounded-2xl border"
          style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold" style={{ color: '#121c28' }}>{post.author}</span>
            <span className="text-[10px]" style={{ color: '#7b7487' }}>{post.time}</span>
          </div>
          <p className="text-xs leading-relaxed line-clamp-3" style={{ color: '#121c28' }}>
            {post.content}
          </p>
          <div className="flex gap-3 text-[10px] mt-2" style={{ color: '#7b7487' }}>
            <span>❤ {post.likes}</span>
            <span>💬 {post.comments}</span>
          </div>
        </motion.button>
      ))}
    </div>
  </div>
)}

{/* 人格线索 */}
{profile.personaSketch && (
  <div className="mt-6">
    <h3 className="text-xs font-bold uppercase mb-3" style={{ color: '#7b7487' }}>人格线索</h3>
    <div className="p-4 rounded-2xl border" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
      <p className="text-xs leading-relaxed whitespace-pre-wrap mb-4" style={{ color: '#121c28' }}>
        {profile.personaSketch.narrative}
      </p>
      <div className="space-y-3">
        {profile.personaSketch.sections.map((s) => (
          <div key={s.key}>
            <p className="text-[10px] font-bold mb-1" style={{ color: '#2B8AEF' }}>{s.title}</p>
            <p className="text-xs leading-relaxed" style={{ color: '#4a4455' }}>{s.narrative}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
)}

{/* 理想伴侣 */}
{profile.idealPartnerSketch && (
  <div className="mt-6">
    <h3 className="text-xs font-bold uppercase mb-3" style={{ color: '#7b7487' }}>理想伴侣</h3>
    <div className="p-4 rounded-2xl border" style={{ backgroundColor: '#ffffff', borderColor: '#d9e3f4' }}>
      <p className="text-xs leading-relaxed whitespace-pre-wrap mb-4" style={{ color: '#121c28' }}>
        {profile.idealPartnerSketch.narrative}
      </p>
      <div className="flex justify-center">
        <RadarChart dimensions={profile.idealPartnerSketch.dimensions} />
      </div>
    </div>
  </div>
)}
```

文件顶部 import：

```tsx
import { RadarChart } from '../../components/RadarChart';
```

#### 步骤 D3：App.tsx 透传 onOpenPost

文件：`echo/src/App.tsx:444-446, 522-524`

```tsx
// Route 定义（444 行附近）
<Route
  path="/user/:userId"
  element={
    <UserProfileRoute
      currentUserId={currentUserId}
      onBack={() => navigate(-1)}
      onOpenPost={(id) => navigate(`/post/${id}`)}   // ← 新增
    />
  }
/>

// UserProfileRoute 组件（522-524 行）
function UserProfileRoute({
  currentUserId,
  onBack,
  onOpenPost,   // ← 新增
}: {
  currentUserId: string;
  onBack: () => void;
  onOpenPost: (id: string) => void;   // ← 新增
}) {
  const { userId } = useParams();
  return (
    <UserProfileView
      userId={userId!}
      currentUserId={currentUserId}
      onBack={onBack}
      onOpenPost={onOpenPost}   // ← 新增
    />
  );
}
```

#### 验证步骤

1. `npx tsc --noEmit` 通过
2. 广场点其他用户头像 → 主页能看到三新区块
3. 点击主页里的帖子卡片 → 进入 PostDetailView
4. 目标用户无 Onboarding（personaSketch 为 null）→ "人格线索" / "理想伴侣"区块不渲染，不报错
5. 目标用户帖子 < 5 条 → 帖子列表正常显示，无分页符
6. 雷达图入场形变动画顺畅，4 个数值与 `idealPartnerSketch.dimensions` 一致

**改动行数**：~80 行 + App.tsx ~10 行
**风险**：低（纯增量渲染，原有卡片不动）
**回滚**：`git revert` 单次 commit
**预计工时**：1.5-2 小时

### 阶段 E：PostDetailView 帖子作者头像跳转

**目标**：帖子详情页作者头像可点击跳转到用户主页。

**改动文件**（共 2 个）:
1. `echo/src/features/feed/PostDetailView.tsx` — 头像包 `<button>` + 接收 `onOpenProfile` prop
2. `echo/src/App.tsx:391-396, 484-498` — `PostRoute` 透传 `onOpenProfile`

#### 步骤 E1：PostDetailView 接收 onOpenProfile prop

文件：`echo/src/features/feed/PostDetailView.tsx`，找到组件 props 定义（搜索 `PostDetailViewProps` 或 `export function PostDetailView`）

```tsx
// 新增 onOpenProfile?: (userId: string) => void
```

#### 步骤 E2：作者头像包 button

文件：`echo/src/features/feed/PostDetailView.tsx:173-180`

```tsx
// 改前
{display.authorAvatarUrl ? (
  <img src={display.authorAvatarUrl} alt={display.author} className="w-10 h-10 rounded-full object-cover" />
) : (
  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(43,138,239,0.12)' }}>
    <Fingerprint className="w-5 h-5" style={{ color: '#2B8AEF' }} />
  </div>
)}

// 改后
<button
  type="button"
  onClick={() => display.authorUserId && onOpenProfile?.(display.authorUserId)}
  className="shrink-0 rounded-full transition-transform hover:scale-[1.05]"
>
  {display.authorAvatarUrl ? (
    <img src={display.authorAvatarUrl} alt={display.author} className="w-10 h-10 rounded-full object-cover" />
  ) : (
    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(43,138,239,0.12)' }}>
      <Fingerprint className="w-5 h-5" style={{ color: '#2B8AEF' }} />
    </div>
  )}
</button>
```

#### 步骤 E3：App.tsx 透传 onOpenProfile

文件：`echo/src/App.tsx`

```tsx
// Route（393-396 行附近）
<Route
  path="/post/:id"
  element={
    <PostRoute
      posts={posts}
      onBack={() => navigate(-1)}
      onOpenProfile={(userId) => navigate(`/user/${userId}`)}   // ← 新增
    />
  }
/>

// PostRoute 组件（484-498 行附近）
function PostRoute({
  posts,
  onBack,
  onOpenProfile,   // ← 新增
}: {
  posts: Post[];
  onBack: () => void;
  onOpenProfile: (userId: string) => void;   // ← 新增
}) {
  // ...把 onOpenProfile 透传给 PostDetailView
}
```

#### 验证步骤

1. `npx tsc --noEmit` 通过
2. 进入 PostDetailView，点击作者头像 → 跳转到 `/user/{authorUserId}`
3. 点击后退 → 回到 PostDetailView
4. 作者无 `authorUserId`（理论不该发生，但兜底）→ 点击无反应，不报错
5. hover 时头像轻微缩放，有视觉反馈

**改动行数**：~15 行 + App.tsx ~5 行
**风险**：极低（独立小改）
**回滚**：`git revert` 单次 commit
**预计工时**：20-30 分钟

### 阶段 F：评论区头像跳转（含后端字段补齐）

**目标**：评论作者头像（顶层 + 回复两层）可点击跳转。需要后端补 `author_user_id` + 前端 4 处联动。

**改动文件**（共 4 个）:
1. `services/api/src/feed/feed.service.ts:144-186` — 评论序列化加 `author_user_id`
2. `echo/src/api/feed.ts:17-28, 128-145` — `CommentItem` 类型 + `parseComments` 解析
3. `echo/src/features/feed/PostDetailView.tsx:210-211, 265-266` — 评论区头像包 `<button>`
4. （E 步骤已完成）`PostDetailView` props 已含 `onOpenProfile`，无需再改

#### 步骤 F1：后端评论序列化加 author_user_id

文件：`services/api/src/feed/feed.service.ts:144-186`

顶层评论序列化（约 146-163 行）加：

```ts
// 在每个 comment map 里加一行
author_user_id: c.clone.userId,
```

回复序列化（约 166-184 行）加：

```ts
author_user_id: r.clone.userId,
```

> **数据已加载**：`getOne` 的 Prisma 查询（`feed.service.ts:104` 附近）已 `include: { clone: { include: { user: { include: { profile: true } } } } } }`，`c.clone.userId` 可直接访问，无需改查询。

#### 步骤 F2：前端 CommentItem 类型扩展

文件：`echo/src/api/feed.ts:17-28`

```ts
export type CommentItem = {
  id: string;
  content: string;
  author: string;
  author_avatar: string | null;
  author_user_id?: string | null;   // ← 新增
  created_at: string;
  parent_id: string | null;
  clone_id: string;
  likes: number;
  liked: boolean;
  replies?: CommentItem[];
};
```

#### 步骤 F3：前端 parseComments 解析扩展

文件：`echo/src/api/feed.ts:128-145`

在 `parseComments` 函数里每条 comment 映射时加：

```ts
author_user_id: typeof row.author_user_id === 'string' ? row.author_user_id : null,
```

#### 步骤 F4：PostDetailView 评论区头像包 button

文件：`echo/src/features/feed/PostDetailView.tsx`

顶层评论头像（约 210-211 行）：

```tsx
// 改前
{comment.author_avatar ? (
  <img src={comment.author_avatar} alt={comment.author} className="w-8 h-8 rounded-full object-cover shrink-0" />
) : (
  <div className="..."> <Fingerprint ... /> </div>
)}

// 改后
<button
  type="button"
  onClick={() => comment.author_user_id && onOpenProfile?.(comment.author_user_id)}
  className="shrink-0 rounded-full transition-transform hover:scale-[1.05]"
>
  {comment.author_avatar ? (
    <img src={comment.author_avatar} alt={comment.author} className="w-8 h-8 rounded-full object-cover" />
  ) : (
    <div className="..."> <Fingerprint ... /> </div>
  )}
</button>
```

回复头像（约 265-266 行）同样改，用 `r.author_user_id`。

> `PostDetailView` 在阶段 E 已加 `onOpenProfile` prop，无需再改 props。

#### 验证步骤

1. `cd services/api && npm run build` 通过
2. `curl http://localhost:4000/v1/posts/<postId>` 返回的 `comments_list` 每条 comment 含 `author_user_id` 字段
3. 前端 `npx tsc --noEmit` 通过
4. PostDetailView 评论区点击顶层评论头像 → 跳转到 `/user/{author_user_id}`
5. 点击回复头像 → 同样跳转
6. 旧评论（理论所有评论都有 cloneId → userId）无 `author_user_id` 时不报错（兜底 null）

**改动行数**：后端 ~5 行 + 前端 ~25 行
**风险**：低（评论序列化加字段，不动 schema、不动查询）
**回滚**：`git revert` 单次 commit
**预计工时**：30-45 分钟

---

## 五、关键风险与权衡

### 5.1 personaSketch 给陌生人看是否有隐私问题？

**产品语义判断**：Echo 是"LLM 人格克隆的社交平台"，分身的 persona 本就是要展示给他人看的——personaSketch 是 LLM 用于"扮演"该用户的素材，把它展示给陌生人完全符合产品语义。`clones.service.ts:81` 注释明确："让前端从单一 API 拿到分身页全量数据"——分身页就是给别人看的。

**风险等级**：低 — 与产品核心语义一致。

### 5.2 idealPartnerSketch 的 dimensions 完整对陌生人开放

**用户决策（已确认）**：dimensions 用雷达图展示，不隐藏。

**权衡**：dimensions 是 4 个 -1~+1 的数值（情感安全 / 独立空间 / 直接沟通 / 冲突处理），本质是匹配算法的副产物。给陌生人看反而有解读价值——能立刻看出"这个人需要高情感安全 + 高直接沟通"，避免 mismatch。不像 Big Five/MFT 那种维度分数泄露内部评分，4 个维度本身就是为"被看见"设计的。

**风险等级**：低 — 用户已明确确认。

### 5.3 帖子列表的拉黑过滤（服务端兜底）

**当前设计（已确认纳入阶段 A）**：`getPublicProfile` 方法开头注入 `BlockFilterService`，调 `getBlockedUserIds(currentUserId)` 做早期 403 检查。若当前用户与目标用户存在任一方向的拉黑关系，直接抛 `ForbiddenException`，前端 `loadPublicProfile` 走 `!res.ok` 分支返回 null，UserProfileView 显示"无法加载用户资料"。

**解决的问题**：用户 A 拉黑了 B，但 B 仍可通过直接输入 URL `/user/{A.userId}` 访问 A 的主页——尤其是 personaSketch 和 idealPartnerSketch 这种深度画像，泄露给被拉黑者不合适。服务端 403 兜底让 B 即使绕过前端拉黑限制（前端 FeedView 不展示被拉黑者的帖子/头像），也无法拿到 A 的资料。

**设计权衡（403 而非 404）**：403 与"该用户不存在"的视觉表现一致（前端 `loadPublicProfile` 不区分错误码，统一返回 null + 显示"无法加载用户资料"），不暴露 A 的存在性给 B。如果用 404 反而泄露"A 存在但你不能看"的信息。

**双层防线**：
- 第一道（产品语义层）：前端 FeedView 拉黑后不展示对方头像——产品层面"你看不到对方"
- 第二道（安全层）：服务端 `getPublicProfile` 403 兜底——技术层面"你即使绕过前端也拿不到对方资料"

**风险等级**：低 — 走与 `feed.service.ts:31-39` 完全相同的 `BlockFilterService` 调用路径，已验证模式，无新代码模式风险。

### 5.4 帖子列表分页

**当前设计**：返回前 5 条预览 + 总数 `postCount`，不做分页。

**潜在问题**： prolific 用户可能有几十上百篇帖子，前 5 条不够看。

**对策**：本次先 5 条，若用户反馈不够，阶段 A2 的 `findMany` 加 cursor 分页（仿 `feed.service.ts:32-55` 的 `cursor + take + skip` 模式），前端 UserProfileView 加"加载更多"按钮。

**风险等级**：低 — 5 条预览 + 总数已满足"判断对方是谁"的核心需求。

### 5.5 雷达图无依赖手写 SVG 的维护成本

**当前设计**：仿 `ProgressRing.tsx` 手写 `<polygon>` + `<line>`，零依赖。

**权衡**：相比引入 recharts（~50KB gzipped），手写 SVG 代码量约 100 行，维护成本低，且完全控制样式与动画。项目已有手写 SVG 先例（ProgressRing），团队熟悉此模式。

**风险等级**：低 — 已有先例，模式可控。

### 5.6 `mapPost` 抽离可能影响现有调用

**当前设计**：把 `feed.service.ts` 的 `private mapPost` 抽成独立 `feed.helper.ts` 的 `mapPostDto`，`feed.service.ts` 内部调用从 `this.mapPost` 改成 `mapPostDto`。

**潜在问题**：`list` 和 `getOne` 都用了 `this.mapPost`，抽离后两处调用都要改。

**对策**：抽离后跑现有 feed 接口测试，确认返回 shape 不变。

**风险等级**：低 — 纯重构，shape 不变。

---

## 六、未决问题确认结果

1. **idealPartnerSketch dimensions 展示形式** — ✅ **已确认**：用雷达图展示 4 维数值（emotionalSafety / spaceRespect / directCommunication / conflictResolution）
2. **评论区头像跳转** — ✅ **已确认**：顶层评论 + 回复两层头像都支持跳转
3. **实施顺序** — ✅ **已确认**：A → B → C → D → E → F
4. **personaSketch 给陌生人看** — ✅ **已确认**：完整展示 narrative + 7 段 sections
5. **帖子列表分页** — ⚠️ **暂未决**：先 5 条 + 总数，若用户反馈不够再加 cursor 分页
6. **拉黑过滤服务端兜底** — ✅ **已确认**：纳入阶段 A 一并实现，注入 BlockFilterService + 早期 403 检查（见 §3.1 第 4 条 + §5.3）

---

## 七、附录：关键代码引用索引

### 后端
- `services/api/src/profile/profile.controller.ts:23-27` — `GET /users/:userId/profile` 路由
- `services/api/src/profile/profile.service.ts:68-107` — `getPublicProfile` 现状（待扩展）
- `services/api/src/clones/clones.service.ts:153-178` — personaSketch / idealPartnerSketch 解析逻辑（可复用）
- `services/api/src/clones/clones.controller.ts:80-145` — `GetMeResponseDto` 完整字段定义
- `services/api/src/onboarding/survey-schema.ts:140-155` — `IdealPartnerSketch` 类型定义
- `services/api/src/feed/feed.service.ts:28-55` — `list` 帖子查询 + 拉黑过滤 + cursor 分页（模式参考）
- `services/api/src/feed/feed.service.ts:104, 144-186` — `getOne` 评论序列化（缺 `author_user_id`，待补）
- `services/api/src/feed/feed.service.ts:194-236` — `mapPost`（待抽离为 helper）
- `services/api/src/feed/feed.controller.ts:20-25` — `GET /posts/:id` 路由
- `services/api/prisma/schema.prisma:80-96` — `Profile` model（含 `bioJson`）
- `services/api/prisma/schema.prisma:119-136` — `DigitalClone` model（`userId @unique`）
- `services/api/prisma/schema.prisma:173-189` — `Comment` model（仅 `cloneId`，无直接 `userId`）

### 前端
- `echo/src/api/notification.ts:83-96` — `PublicProfile` 类型 + `loadPublicProfile`（待扩展类型）
- `echo/src/api/feed.ts:17-28` — `CommentItem` 类型（待加 `author_user_id`）
- `echo/src/api/feed.ts:54-91` — `mapApiPost`（snake → camelCase 映射，含 `authorUserId`）
- `echo/src/api/feed.ts:104-149` — `loadFeed` / `loadPostDetail`
- `echo/src/api/feed.ts:128-145` — `parseComments`（待加 `author_user_id` 解析）
- `echo/src/types.ts:10-20` — `Post` 类型（已含 `authorUserId?: string | null`）
- `echo/src/features/profile/UserProfileView.tsx` — 主页组件（待加三区块）
- `echo/src/features/feed/FeedView.tsx:117-133` — 已有头像 `<button>` 包裹 + 跳转（参考模式）
- `echo/src/features/feed/PostDetailView.tsx:173-180` — 作者头像（待包 button）
- `echo/src/features/feed/PostDetailView.tsx:210-211, 265-266` — 评论头像（待包 button）
- `echo/src/features/onboarding/v2/components/DimensionBars.tsx` — 4 维条形图（数据契约同构，可参考）
- `echo/src/features/onboarding/v2/components/ProgressRing.tsx` — 手写 SVG 先例（雷达图仿照）
- `echo/src/features/onboarding/v2/onboarding-v2.types.ts:168-173` — `IdealPartnerSketchDimensions` 类型
- `echo/src/App.tsx:370-483` — 路由表（`/user/:userId`、`/post/:id`）
- `echo/src/App.tsx:484-488` — `PostRoute` 组件（待透传 `onOpenProfile`）
- `echo/src/App.tsx:522-524` — `UserProfileRoute` 组件（待透传 `onOpenPost`）
- `echo/src/App.tsx:560-568` — `MainLayout` 内 `FeedView` 的 `onOpenProfile` 透传（已有先例，第 566 行透传）

---

## 八、附录 B：代码引用校对结果

> **校对方法**：派 subagent 逐项核对 §一～§七 引用的 36 个代码位置（文件路径 + 行号 + 内容描述），与项目实际代码做对照。
> **校对时间**：2026-07-21
> **校对结论**：✅ 33 项准确 / ⚠️ 3 项小偏差（行号偏移，不涉及路径或内容错误）/ ❌ 0 项错误
> **处理结果**：3 处偏差已全部修正——第 2 项在 §一正文修正、§七附录修正两处（PostRoute 与 MainLayout FeedView 块）

### 8.1 后端引用校对

| # | 引用 | 校对结果 |
|---|------|---------|
| 1 | `services/api/src/profile/profile.service.ts:68-107` — `getPublicProfile` 方法 | ✅ 准确（68 行方法签名，107 行闭合 `}`） |
| 2 | `services/api/src/profile/profile.service.ts:84-92` → 修正为 `92-95` — bioJson 解析（interests + goalOnEcho） | ⚠️ 偏差已修正：原引用 84-92 实际是 postCount 计数逻辑，真正 bioJson 解析在 92-95 |
| 3 | `services/api/src/clones/clones.service.ts:153-178` — personaSketch / idealPartnerSketch 解析 | ✅ 准确（含 scenarioCards + persona + ideal 三段解析，范围合理涵盖） |
| 4 | `services/api/src/feed/feed.service.ts:28-55` — `list` 的 findMany + 拉黑过滤 + cursor 分页 | ✅ 准确（28 行 findMany，33-35 拉黑过滤，40 行 cursor，54 行 hasMore） |
| 5 | `services/api/src/feed/feed.service.ts:104` — getOne Prisma 查询含 `include: { clone: { include: { user: { include: { profile: true } } } } } }` | ✅ 准确（104 行正是该 include） |
| 6 | `services/api/src/feed/feed.service.ts:144-186` — 评论序列化（顶层 + 回复） | ✅ 准确（144 行 `comments_list:` map 开头，186 行闭合） |
| 7 | `services/api/src/feed/feed.service.ts:194-236` — `mapPost` 方法 | ✅ 准确（194 行方法签名，236 行闭合） |
| 8 | `services/api/src/feed/feed.service.ts:226` — `author_user_id: p.clone.userId` | ✅ 准确（精确到行） |
| 9 | `services/api/src/feed/feed.controller.ts:20-25` — `@Get('posts/:id')` 路由 | ✅ 准确 |
| 10 | `services/api/src/profile/profile.controller.ts:23-27` — `@Get('users/:userId/profile')` 路由 | ✅ 准确 |
| 11 | `services/api/src/onboarding/survey-schema.ts:140-155` — `IdealPartnerSketch` 类型定义 | ✅ 准确（interface 在 140 行，关键字段在 141-153 范围内） |
| 12 | `services/api/prisma/schema.prisma:80-96` — `Profile` model | ✅ 准确（80 行 model 开头，含 bioJson 等字段，96 行 embedding 关系） |
| 13 | `services/api/prisma/schema.prisma:119-136` — `DigitalClone` model | ✅ 准确（精确匹配） |
| 14 | `services/api/prisma/schema.prisma:173-189` — `Comment` model | ✅ 准确（精确匹配） |

### 8.2 前端 API/类型校对

| # | 引用 | 校对结果 |
|---|------|---------|
| 15 | `echo/src/api/notification.ts:83-96` — `PublicProfile` 类型 + `loadPublicProfile` | ✅ 准确（接口 83-92，函数 94-96） |
| 16 | `echo/src/api/feed.ts:17-28` — `CommentItem` 类型 | ✅ 准确（精确匹配） |
| 17 | `echo/src/api/feed.ts:54-91` — `mapApiPost` 函数 | ✅ 准确 |
| 18 | `echo/src/api/feed.ts:78-79, 85` — `author_user_id` 读取 + 写入 `authorUserId` | ✅ 准确（78 行 const 声明，79 行三元，85 行 return 字段） |
| 19 | `echo/src/api/feed.ts:128-145` — `parseComments` 函数 | ✅ 准确 |
| 20 | `echo/src/types.ts:10-20` — `Post` 接口（`authorUserId?: string \| null` 在第 15 行） | ✅ 准确 |

### 8.3 前端组件校对

| # | 引用 | 校对结果 |
|---|------|---------|
| 21 | `echo/src/features/profile/UserProfileView.tsx` 总行数约 205 行 | ✅ 准确（末行 `}` 在 205 行） |
| 22 | `echo/src/features/feed/FeedView.tsx:117-133` — 头像 `<button>` 包裹 + onClick 跳转 | ✅ 准确（117 行 `<button`，119-123 onClick，127-132 img 渲染） |
| 23 | `echo/src/features/feed/PostDetailView.tsx:173-180` — 作者头像 `<img>`（无 onClick） | ✅ 准确 |
| 24 | `echo/src/features/feed/PostDetailView.tsx:210-211` — 顶层评论头像 `<img>` | ✅ 准确 |
| 25 | `echo/src/features/feed/PostDetailView.tsx:265-266` — 回复头像 `<img>` | ✅ 准确 |
| 26 | `echo/src/features/onboarding/v2/components/DimensionBars.tsx:27` — 值映射公式 `((value + 1) / 2) * 100` | ✅ 准确 |
| 27 | `echo/src/features/onboarding/v2/components/ProgressRing.tsx` — 手写 SVG 先例 | ✅ 准确（26-47 行手写 `<svg>` + 双 `<circle>` + `strokeDasharray`） |
| 28 | `echo/src/features/onboarding/v2/onboarding-v2.types.ts:168-173` — `IdealPartnerSketchDimensions` 类型 | ✅ 准确（168 行 interface，169-172 字段，173 行闭合） |
| 29 | `echo/src/features/onboarding/v2/Phase1_6IdealSketch.tsx:133` — `<DimensionBars dimensions={sketch.dimensions} />` | ✅ 准确（精确到行） |

### 8.4 App.tsx 路由校对

| # | 引用 | 校对结果 |
|---|------|---------|
| 30 | `echo/src/App.tsx:370-483` — 路由表 | ✅ 准确（370 行 onboarding `<Routes>`，391 行主路由表，475 行闭合，484 行起 PostRoute） |
| 31 | `echo/src/App.tsx:391-396` — `/post/:id` 路由定义 | ✅ 准确（393 行 `<Route`，394 行 `path="/post/:id"`，396 行 `/>`） |
| 32 | `echo/src/App.tsx:444-446` — `/user/:userId` 路由定义 | ✅ 准确（444 行 `path="/user/:userId"`，445 行 element，446 行 `/>`） |
| 33 | `echo/src/App.tsx:484-498` → 修正为 `484-488` — `PostRoute` 组件 | ⚠️ 偏差已修正：原引用 484-498 超出 PostRoute 函数末尾 10 行（实际含下一个 MatchRoute 开头），改为 484-488 |
| 34 | `echo/src/App.tsx:522-524` — `UserProfileRoute` 组件 | ✅ 准确（522 行函数签名，523 行 useParams，524 行 return） |
| 35 | `echo/src/App.tsx:560-580` → 修正为 `560-568` — MainLayout 内 `FeedView` 块 | ⚠️ 偏差已修正：原引用 560-580 超出 FeedView 块 12 行（实际含 MatchView 开头），改为 560-568；onOpenProfile 在第 566 行 |
| 36 | `echo/src/App.tsx:566` — `onOpenProfile={(userId) => navigate(\`/user/${userId}\`)}` | ✅ 准确（精确到行） |

### 8.5 校对小结

- **零路径错误**：所有 36 项引用的文件路径均存在且正确
- **零内容错误**：所有引用的"描述内容"与代码实际语义一致（不存在把 mapPost 写成 list、把 Profile model 写成 Comment model 这种描述性错误）
- **3 处行号偏差已修正**：
  1. §一 §3.1 中的 `profile.service.ts:84-92` → 修正为 `92-95`（bioJson 解析位置）
  2. §七附录中的 `App.tsx:484-498` → 修正为 `484-488`（PostRoute 函数范围）
  3. §七附录中的 `App.tsx:560-580` → 修正为 `560-568`（FeedView 块范围）
- **校对方法可复现**：任一引用均可通过 `sed -n '<start>,<end>p' <file>` 命令验证
