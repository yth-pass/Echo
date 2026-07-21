# 评论功能补全

## 问题
用户反馈：登录后在帖子详情页点击评论无法评论，问"不是修改了吗"。

经核查，**评论的"写入"链路从未实现过**——不是改坏了：
- ✅ 数据库：`Comment` 表早已存在（schema.prisma:172）
- ✅ 后端读取：`feed.service.getOne` 一直返回 `comments_list`
- ✅ 前端展示：`PostDetailView` 能显示评论列表
- ❌ 后端写入：无 `POST /posts/:id/comments` 接口
- ❌ 前端输入：`PostDetailView` 无评论输入框，`feed.ts` 无发送函数

用户把之前 07-06/07-07 做的"帖子编辑 / 自动发帖 / 分身页改造"误记成评论修复。本次补全缺失的写入链路。

## 方案
评论走**同步审核**（用户选定：先用 DeepSeek 审核敏感词再发布），复用现有 `ModerationService` 两阶段管线：
1. 敏感词正则扫描（命中即拒）
2. DeepSeek LLM 分类（safe / unsafe / needs_review）

- `safe` → 立即创建 Comment，立即可见
- `unsafe` → 400 拒绝，返回原因
- `needs_review` → 400 拒绝，提示修改后重试

不走异步入队（与帖子不同），因为评论是用户直接输入、需即时反馈。

## 改动文件

### 后端
| 文件 | 改动 |
|------|------|
| `services/api/src/posts/posts.module.ts` | import `ModerationModule`，让 PostsController 可注入 ModerationService |
| `services/api/src/posts/posts.controller.ts` | 新增 `CreateCommentDto`；构造函数注入 ModerationService；新增 `POST :id/comments` → addComment（校验登录/clone/帖子存在 → 同步审核 → 创建 Comment → 审计） |

### 前端
| 文件 | 改动 |
|------|------|
| `Echo/src/api/feed.ts` | 新增 `CommentItem` 类型 + `createComment(postId, content)` 函数 |
| `Echo/src/features/feed/PostDetailView.tsx` | 新增评论输入栏（textarea + 发送按钮）+ handleSendComment 乐观更新逻辑 |

## 接口契约

### POST /posts/:id/comments
- 鉴权：JwtAuthGuard（需登录）
- 限流：20 次/分钟（类级 @Throttle）
- Body：`{ "content": "评论内容" }`（1-500 字）
- 响应（safe）：
  ```json
  {
    "id": "comment-uuid",
    "content": "评论内容",
    "author": "分身昵称",
    "author_avatar": "https://... 或 null",
    "created_at": "2026-07-07T..."
  }
  ```
- 错误：
  - 400 `评论内容不合规：...`（unsafe，含审核原因）
  - 400 `评论内容需人工审核，请修改后再试`（needs_review）
  - 404 `尚未创建分身` / `帖子不存在`

## 验证
- 后端 `tsc --noEmit` → EXIT=0
- 前端 `tsc --noEmit` → EXIT=0

## 生效条件
**需重启后端 API 进程**（PostsModule 新引入了 ModerationModule 依赖注入变更）。重启后前端无需重新构建即可使用（接口已就绪，前端已接好输入框）。

## 备注
- Comment 表未加 `moderationStatus` 字段：safe 才写入，不保留被拒评论，无需数据库迁移
- 乐观更新：发送成功后前端直接追加到本地 `comments_list`，不重新拉详情，减少请求
- DeepSeek 审核依赖 `DEEPSEEK_API_KEY` 环境变量；未配置时 LLM 阶段返回 needs_review（评论会被拒），需确保 API 进程的 .env 配置了该 key
