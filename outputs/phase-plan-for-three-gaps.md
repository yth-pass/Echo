# Echo 三相断层修复 — 阶段规划 & AI 执行提示词

> 生成日期: 2026-06-21 | 分析基础: 三个 Explore Agent 全面代码审计

---

## 问题总览

| # | 断层名称 | 严重度 | 违反的规格 | 影响范围 |
|---|---------|--------|-----------|---------|
| G1 | 匹配质量断层 | 🔴 致命 | PRD FR-040, FR-041 | 所有用户匹配结果 |
| G2 | 客户端断层 | 🟠 严重 | P1-14, P1-15 校园侧载关口 | Android 用户体验 |
| G3 | 目标设计-实现断层 | 🟡 重要 | M1-M6 架构设计 | Agent 对话质量 |

---

## G1: 匹配质量断层 — 4 阶段修复

### 现状诊断

```
fakeEmbedding(userId) → 1536维确定性伪随机向量
    ↓
pgvector HNSW cosine 搜索
    ↓
语义上无意义的排序 ≈ 随机排列
```

关键代码位置：
- **降级函数**: `services/api/src/llm/llm.service.ts:122-128` (fakeEmbedding)
- **匹配引擎**: `services/worker/src/clone-runtime/match-bridge.ts:9-55` (pgvector HNSW)
- **Embedding生成**: `services/api/src/onboarding/onboarding.service.ts:236-254`
- **需求 FR-040**: 用户匹配偏好（性别/年龄/距离/意图）— **完全未实现**
- **需求 FR-041**: 画像兼容性排序（向量 + 规则）— 仅有向量，无规则层

---

### Phase 1.1: 确保真实 Embedding API 可用

**目标**: 让入驻流程生成的向量具有语义含义。

**涉及文件**:
- `services/api/src/llm/llm.service.ts`（L64-86）
- `services/api/src/onboarding/onboarding.service.ts`（L236-254）
- `services/worker/src/clone-runtime/llm.ts`（L80-86）

**具体变更**:

```
1. 在 llm.service.ts 中增加 DEEPSEEK_EMBED_MODEL 环境变量未设置时的告警级别提升（warn → error）
2. 在 onboarding.service.ts 中增加 embedding 质量校验：
   - 检查向量是否全零或全相等 → 标记为无效，阻止入驻完成
   - 对 fakeEmbedding 回退增加明确的 metrics 埋点（知会运维）
3. 在 match-bridge.ts 中增加 embedding 有效性检查：
   - 对全零/常量向量跳过，不参与匹配
   - 记录被跳过的用户数
```

**AI 执行提示词**:

```
你是 Echo 项目的后端工程师。请修改以下三个文件，实现真实 Embedding API 的可靠性保障：

【任务背景】
当前 `fakeEmbedding(userId)` 在 DEEPSEEK_API_KEY 缺失或 API 调用失败时，生成确定性伪随机向量作为回退。这使得 pgvector HNSW 的余弦搜索退化为无意义的随机排列。我们需要确保：1）API 不可用时明确告知运维；2）嵌入质量可被检测；3）无效向量不会污染匹配结果。

【文件1: services/api/src/llm/llm.service.ts】
修改 `embed()` 方法（L64-86）和 `embedBatch()` 方法（L91-112）：
- 保留现有 try/catch 和 fakeEmbedding 回退逻辑不变
- 在回退发生时，除了现有 warn 日志外，增加一个 boolean 返回值标记 `quality: 'real' | 'fake'`
- 将返回值从 `Promise<number[]>` 改为 `Promise<{ vector: number[]; quality: 'real' | 'fake' }>`（embedBatch 同理，返回 `{ vectors: number[][]; quality: 'real' | 'fake' }`）
- 注意：这是一个Interface变更，需要同步修改所有调用方（onboarding.service.ts、clone-runtime/llm.ts）

【文件2: services/api/src/onboarding/onboarding.service.ts】
修改 embedding 写入逻辑（L244-264）：
- 适配 llm.embed() 的新返回格式（{ vector, quality }）
- 当 quality === 'fake' 时，记录 error 级别日志 "User embedding is fake — matching quality degraded for userId={userId}"
- 增加向量有效性检查：如果 vector 全为零（every v===0）或标准差 < 0.001，跳过写入并记录 error
- 仅当 quality === 'real' 且向量有效时，才执行 INSERT INTO profile_embeddings

【文件3: services/worker/src/clone-runtime/llm.ts】
同步修改 worker 侧的 fakeEmbedding 回退逻辑（L60-73）：
- 保持与 llm.service.ts 相同的返回格式 { vector, quality }
- 回退时 quality='fake'，成功时 quality='real'
- 检查有没有其他地方调用 worker 侧的 embed，如果有也一并适配

【约束】
- 不能删除 fakeEmbedding 回退（需要确保 API 不可用时服务不崩溃）
- 所有变更必须保持向后兼容的类型安全
- 不要修改 match-bridge.ts（下一阶段处理）
```

---

### Phase 1.2: 丰富 Embedding 文本构建

**目标**: 让嵌入文本包含更丰富的语义维度，提升向量质量。

**涉及文件**: `services/api/src/onboarding/onboarding.service.ts`（L236-243）

**当前问题**:
```typescript
const textForEmbedding = [
  profile?.displayName ?? '',
  bioText,
  profile?.styleMd ?? '',
].filter(Boolean).join('\n') || userId;
```
仅用 displayName + bio + style 三个字段，缺乏结构化语义。

**AI 执行提示词**:

```
你是 Echo 项目的后端工程师。请修改 `services/api/src/onboarding/onboarding.service.ts` 中的 embedding 文本构建逻辑。

【任务背景】
当前 embedding 文本仅由 displayName + bio + style 拼接，缺乏结构化的语义信息。FR-041 要求 "向量+规则" 的兼容性排序，向量质量是基础。DeepSeek embedding 模型对结构化标签比自然语言散列更敏感。

【修改位置: services/api/src/onboarding/onboarding.service.ts L236-243】

将 `textForEmbedding` 的构建逻辑改为多维度结构化拼接：

```typescript
// 读取用户完整 profile 和入驻问卷数据
const profile = await this.prisma.profile.findUnique({ where: { userId } });
const survey = profile?.surveyJson as Record<string, any> | undefined;

// 构建结构化 embedding 文本
const parts: string[] = [];

// 维度1: 身份标签
if (profile?.displayName) parts.push(`昵称:${profile.displayName}`);

// 维度2: 人口统计特征（来自survey或bioJson）
const bio = profile?.bioJson as Record<string, string> | undefined;
if (bio) {
  if (bio.gender) parts.push(`性别:${bio.gender}`);
  if (bio.age || bio.birthYear) parts.push(`年龄:${bio.age || bio.birthYear}`);
  if (bio.city) parts.push(`城市:${bio.city}`);
  if (bio.occupation) parts.push(`职业:${bio.occupation}`);
  if (bio.education) parts.push(`学历:${bio.education}`);
}

// 维度3: 兴趣标签（来自survey）
if (survey?.interests && Array.isArray(survey.interests)) {
  parts.push(`兴趣:${survey.interests.join(',')}`);
}
if (survey?.hobbies && Array.isArray(survey.hobbies)) {
  parts.push(`爱好:${survey.hobbies.join(',')}`);
}

// 维度4: 关系意图
if (survey?.relationshipIntent) {
  parts.push(`关系意图:${survey.relationshipIntent}`);
}

// 维度5: 风格摘要（由M2 Style Engine生成）
if (profile?.styleMd) {
  parts.push(`沟通风格:${profile.styleMd}`);
}

// 维度6: 价值观关键词（如有）
if (survey?.values && Array.isArray(survey.values)) {
  parts.push(`价值观:${survey.values.join(',')}`);
}

const textForEmbedding = parts.join(' | ') || userId;
```

【重要】
1. 使用 `|` 分隔符而不是换行，因为 DeepSeek embedding 对键值对格式更友好
2. 保留 userId 作为最终 fallback
3. 使用 optional chaining 处理所有字段可能为 null/undefined 的情况
4. 不改变 embedding 写入的 SQL 逻辑（L257-264保持不变）
5. 确保 TypeScript 编译通过
```

---

### Phase 1.3: 实现 FR-040 匹配偏好预过滤

**目标**: 在向量搜索前应用用户配置的匹配偏好规则。

**涉及文件**:
- `services/worker/src/clone-runtime/match-bridge.ts`（全部，核心修改）
- `services/api/prisma/schema.prisma`（可能需要扩展 Profile 模型）

**AI 执行提示词**:

```
你是 Echo 项目的后端工程师。请实现 FR-040（匹配偏好预过滤），修改 `services/worker/src/clone-runtime/match-bridge.ts` 中的 `runDailyMatchJob` 函数。

【任务背景】
FR-040 要求用户可配置匹配偏好：gender(s) sought, age range, distance, relationship intent。FR-041 要求 "向量 + 规则" 排序。当前 match-bridge.ts 仅做纯向量余弦搜索，完全没有规则过滤。需要在对每个用户做 pgvector 搜索前后，应用匹配偏好规则。

【设计说明】
"向量 + 规则" 的推荐方式是：先规则预过滤缩小候选集，再在候选集内做向量排序。这样既保证了规则约束的硬性满足，又保留了向量语义排序的质量。

【修改文件: services/worker/src/clone-runtime/match-bridge.ts】

在 `runDailyMatchJob` 函数（L9-55）中，对每个用户的匹配流程做如下改造：

1. **读取匹配偏好**（在 for 循环内，L13 之后）：
```typescript
const prefs = await prisma.profile.findUnique({
  where: { userId: e.userId },
  select: { matchPrefsJson: true },
});
const matchPrefs = (prefs?.matchPrefsJson ?? {}) as {
  gender?: string[];
  ageMin?: number;
  ageMax?: number;
  distanceKm?: number;
  relationshipIntent?: string;
};
```

2. **构建 pgvector 查询的 WHERE 子句**：将匹配偏好翻译为 SQL 条件。
   - 如果 matchPrefs 为空对象，不做任何过滤（保持行为不变）
   - 如果有 gender 偏好：在 SQL 中增加 `AND p.bio_json->>'gender' = ANY(ARRAY[...])`
   - 如果有 ageMin/ageMax：在 SQL 中增加 `AND (p.bio_json->>'birthYear')::int BETWEEN ... AND ...`（注：需要根据 birthYear 推算年龄，或读取 survey 中的年龄字段）
   - 如果有 relationshipIntent：子查询或 JOIN survey 表过滤
   - LIMIT 从固定的 3 改为动态：先取 top-K（如10），让规则过滤有足够候选

3. **SQL 查询改造**（L20-29）：
   将简单的 `WHERE pe.user_id != ${e.userId}` 改为带 JOIN profile 的动态查询：
```typescript
const whereConditions: string[] = ['pe.user_id != $1'];
const params: string[] = [e.userId];
let paramIdx = 2;

// 性别过滤
if (matchPrefs.gender?.length) {
  whereConditions.push(`p.bio_json->>'gender' = ANY($${paramIdx}::text[])`);
  params.push(JSON.stringify(matchPrefs.gender));
  paramIdx++;
}

// 年龄范围过滤
if (matchPrefs.ageMin != null || matchPrefs.ageMax != null) {
  // 假设 bio_json 中有 birthYear 字段
  const currentYear = new Date().getFullYear();
  if (matchPrefs.ageMax != null) {
    whereConditions.push(`(p.bio_json->>'birthYear')::int >= $${paramIdx}`);
    params.push(String(currentYear - matchPrefs.ageMax));
    paramIdx++;
  }
  if (matchPrefs.ageMin != null) {
    whereConditions.push(`(p.bio_json->>'birthYear')::int <= $${paramIdx}`);
    params.push(String(currentYear - matchPrefs.ageMin));
    paramIdx++;
  }
}

const candidates = await prisma.$queryRawUnsafe<...>(
  `SELECT pe.user_id, 1 - (pe.embedding <=> $1::vector) AS similarity
   FROM profile_embeddings pe
   JOIN profiles p ON p.user_id = pe.user_id
   WHERE ${whereConditions.join(' AND ')}
   ORDER BY pe.embedding <=> $1::vector
   LIMIT 10`,
  ...params
);
```

4. **规则重新排序**（向量搜索后）：
   对 pgvector 返回的 candidates 进行规则权重调整：
   - 关系意图匹配：+0.10
   - 同城：+0.05
   - 兴趣重叠（需要从 survey 读取）：+0.05
   - 最终排序后取 top 3

5. **降级行为**：如果应用规则过滤后候选数为 0，忽略规则、仅用向量结果（需记录 warn 日志）

【约束】
- 使用 `$queryRawUnsafe` 构建动态 SQL（因为WHERE子句是动态的），但在拼接参数时使用参数化查询（`$${n}`占位符），防止SQL注入
- 如果 profile 表中没有 matchPrefsJson 列，先用 `ALTER TABLE profiles ADD COLUMN match_prefs_json JSONB` 迁移
- 保持 duplicating check（L32-35）和 match push 创建逻辑（L36-46）不变
- 不修改 match-bridge.ts 的其他函数（bridgeMatchPushes）
```

---

### Phase 1.4: 清理冗余匹配实现 + 端到端验证

**目标**: 统一匹配入口，删除 `MatchesService.runDailyMatchJob` 中的冗余 O(n^2) 实现。

**涉及文件**:
- `services/api/src/matches/matches.service.ts`（删除 L108-137 的 `runDailyMatchJob`）
- `services/worker/src/clone-runtime/match-bridge.ts`（作为唯一匹配实现）

**AI 执行提示词**:

```
你是 Echo 项目的后端工程师。请清理冗余的匹配实现代码并编写端到端验证脚本。

【任务背景】
项目中存在两个并行的匹配实现：
1. `services/api/src/matches/matches.service.ts:108-137` — O(n²) 应用层余弦匹配（未使用 pgvector）
2. `services/worker/src/clone-runtime/match-bridge.ts:9-55` — pgvector HNSW 搜索（实际生产使用）

两个实现功能重复且逻辑不一致。需要删除 API 侧的冗余实现，统一为 worker 侧。

【修改1: services/api/src/matches/matches.service.ts】
- 删除 `runDailyMatchJob()` 方法（L108-137）
- 删除 `cosine()` 辅助函数（L140-152）
- 检查是否有其他文件调用 `MatchesService.runDailyMatchJob()`，如果有则改为调用 worker 侧的 `runDailyMatchJob`

【修改2: 编写验证脚本】
在 `services/worker/src/clone-runtime/__tests__/match-bridge.test.ts` 中创建测试：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock PrismaClient
const mockPrisma = {
  profileEmbedding: { findMany: vi.fn() },
  matchPush: { findFirst: vi.fn(), create: vi.fn() },
  profile: { findUnique: vi.fn() },
  $queryRawUnsafe: vi.fn(),
};

describe('runDailyMatchJob', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should skip users with zero-vector embeddings', async () => {
    mockPrisma.profileEmbedding.findMany.mockResolvedValue([{
      userId: 'u1', embedding: new Array(1536).fill(0),
    }]);
    // ...验证 matchPush.create 从未被调用
  });

  it('should filter by gender preference when configured', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      matchPrefsJson: { gender: ['女'] },
    });
    // ...验证 $queryRawUnsafe 包含 gender 过滤条件
  });

  it('should fall back to pure vector when rules yield zero candidates', async () => {
    // ...验证降级行为
  });

  it('should deduplicate matches already pushed', async () => {
    mockPrisma.matchPush.findFirst.mockResolvedValue({ id: 'existing' });
    // ...验证不会重复创建
  });
});
```

【约束】
- 删除代码前确保没有其他调用方（全局搜索 `runDailyMatchJob` 和 `cosine(`）
- 验证脚本使用 vitest（项目已有的测试框架）
- 保持 match-bridge.ts 的其他函数不变
```

---

## G2: 客户端断层 — 7 阶段修复

### 现状诊断

```
Android app/ (32 files)
  ✅ 5-tab NavigationBar (EchoNavHost.kt)
  ✅ 3/5 tabs with API integration (Feed, Match, Clone)
  ✅ Retrofit + Moshi + OkHttp + Hilt DI
  ✅ FCM push notifications
  ✅ Material3 Echo品牌主题
  ❌ 无 Auth/Login/Register 屏幕
  ❌ 无 Onboarding 问卷流程
  ❌ 无 Conversation/Chat 界面
  ❌ 无 Handoff 接受/拒绝 UI
  ❌ 无 Activity/Audit 日志界面（ActivityScreen 占位符）
  ❌ 无 Report 提交界面
  ❌ 无 Clone 编辑功能（persona/boundary）
  ❌ P1-15: 仅构建 debug APK，无 release 签名
```

---

### Phase 2.1: 认证流程（Login + Register）

**目标**: 实现完整的登录/注册 UI 和 token 管理。

**涉及文件**:
- 新建: `app/src/main/java/com/echo/app/ui/screens/auth/LoginScreen.kt`
- 新建: `app/src/main/java/com/echo/app/ui/screens/auth/RegisterScreen.kt`
- 新建: `app/src/main/java/com/echo/app/ui/screens/auth/AuthViewModel.kt`
- 修改: `app/src/main/java/com/echo/app/ui/navigation/EchoNavHost.kt`
- 修改: `app/src/main/java/com/echo/app/data/repository/AuthRepository.kt`

**AI 执行提示词**:

```
你是 Echo Android 项目的 Kotlin/Jetpack Compose 工程师。请实现登录和注册界面。

【项目技术栈】
- Jetpack Compose + Material3
- Hilt 依赖注入
- Retrofit + Moshi 网络层
- Kotlin Coroutines + StateFlow
- 导航: Jetpack Navigation Compose

【现有代码参考】
- API 接口: `app/src/main/java/com/echo/app/data/api/EchoApi.kt` L15-19 已有 register/login 端点
  ```kotlin
  @POST("auth/register")
  suspend fun register(@Body req: RegisterRequest): AuthResponse

  @POST("auth/login")
  suspend fun login(@Body req: LoginRequest): AuthResponse
  ```
- Auth DTOs: `app/src/main/java/com/echo/app/data/api/dto/AuthDtos.kt`
- AuthRepository: `app/src/main/java/com/echo/app/data/repository/AuthRepository.kt` (需扩展)
- AuthInterceptor: `app/src/main/java/com/echo/app/data/api/auth/AuthInterceptor.kt` (token管理已完整)
- 现有主题: `app/src/main/java/com/echo/app/ui/theme/Theme.kt` (Echo品牌粉色 #E91E63)

【任务1: 新建 LoginScreen.kt】
路径: `app/src/main/java/com/echo/app/ui/screens/auth/LoginScreen.kt`

实现一个 Material3 登录界面：
- 顶部: Echo Logo + "Echo 登录" 标题
- 表单: email/phone TextField + password TextField (密码带可见性切换)
- 登录按钮: 使用 Echo 品牌主色 (#E91E63)，圆形圆角 (12dp)
- 底部: "还没有账号？去注册" 可点击文字链
- 状态: idle / loading / error 三种状态
- 错误处理: Snackbar 显示 "登录失败: {error message}"
- 成功: 调用 AuthRepository.saveToken() 后导航到主页面
- 遵循现有 strings.xml 中已有的字符串资源

代码结构:
```kotlin
@Composable
fun LoginScreen(
    onNavigateToRegister: () -> Unit,
    onLoginSuccess: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val uiState by viewModel.loginState.collectAsStateWithLifecycle()
    // Column verticalArrangement = Center, horizontalAlignment = CenterHorizontally
    // 表单在 Card(elevation=4.dp, shape=RoundedCornerShape(16.dp)) 内
    // 两个 OutlinedTextField + 一个 Button
    // LaunchedEffect监听登录成功
}
```

【任务2: 新建 RegisterScreen.kt】
路径: `app/src/main/java/com/echo/app/ui/screens/auth/RegisterScreen.kt`

实现注册界面：
- 表单字段: 昵称、邮箱、手机号、密码、确认密码
- 密码强度指示器（至少8位，包含字母和数字）
- 客户端校验: 密码匹配、邮箱格式、手机号格式
- 注册按钮和底部 "已有账号？去登录" 链接
- 成功: 保存token，导航到入驻流程

【任务3: 新建 AuthViewModel.kt】
路径: `app/src/main/java/com/echo/app/ui/screens/auth/AuthViewModel.kt`

```kotlin
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {
    data class LoginUiState(
        val isLoading: Boolean = false,
        val error: String? = null,
        val isSuccess: Boolean = false
    )

    private val _loginState = MutableStateFlow(LoginUiState())
    val loginState: StateFlow<LoginUiState> = _loginState.asStateFlow()

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _loginState.value = LoginUiState(isLoading = true)
            try {
                val result = authRepository.login(email, password)
                authRepository.saveToken(result.token)
                _loginState.value = LoginUiState(isSuccess = true)
            } catch (e: Exception) {
                _loginState.value = LoginUiState(error = e.message ?: "登录失败")
            }
        }
    }
    // ... register类似
}
```

【任务4: 修改 EchoNavHost.kt】
路径: `app/src/main/java/com/echo/app/ui/navigation/EchoNavHost.kt`

在现有 NavHost 中：
- 添加 auth 路由: `composable("auth/login")` 和 `composable("auth/register")`
- 将 startDestination 改为 `"auth/login"`（app启动先走登录）
- 如果已有有效 token（AuthInterceptor 中可检查），直接跳转到主页
- 保留现有 5-tab 的 bottom navigation 不变

【任务5: 修改 AuthRepository.kt】
扩展 AuthRepository：
- 添加 `saveToken(token: String)` 方法（写入 SharedPreferences）
- 添加 `getToken(): String?` 方法
- 添加 `isLoggedIn(): Boolean` 方法
- 添加 `logout()` 方法（清除 token，导航回登录页）

【约束】
- 所有字符串使用 `R.string.*` 资源引用（strings.xml 已有中文文本）
- 遵循 Material3 设计规范
- 使用 `collectAsStateWithLifecycle()` 而非 `collectAsState()`
- 密码要求至少8位，含字母+数字（客户端校验）
- 键盘IME动作：密码框 ImeAction.Done 触发登录
```

---

### Phase 2.2: 入驻向导 (Onboarding Wizard)

**目标**: 实现 8 步入驻问卷流程。

**AI 执行提示词**:

```
你是 Echo Android 项目的 Compose 工程师。请实现入驻向导流程。

【背景】
Echo 的入驻流程是一个 8 步问卷，收集用户画像信息用于创建 Digital Clone。
后端 API 已就绪：入驻完成后调用 POST /onboarding/finalize 生成克隆和 embedding。
（注：如果 API 尚未暴露入驻问卷 endpoint，你可以先创建一个 OnboardingRepository 使用本地状态管理，最后一步调用现有 API）

【任务: 新建 OnboardingScreen.kt + OnboardingViewModel.kt】

路径: 
- `app/src/main/java/com/echo/app/ui/screens/onboarding/OnboardingScreen.kt`
- `app/src/main/java/com/echo/app/ui/screens/onboarding/OnboardingViewModel.kt`

实现包含以下步骤的 HorizontalPager 向导：

```
Step 1/8: 基础信息 — 昵称、性别（单选按钮）、出生年份（NumberPicker或TextField）
Step 2/8: 位置 — 城市（TextField + 自动完成建议）
Step 3/8: 教育/职业 — 学历（下拉菜单）、职业（TextField）
Step 4/8: 兴趣爱好 — 多选 ChipGroup（预定义标签：运动/音乐/电影/旅行/美食/阅读/游戏/摄影）+ 自定义输入
Step 5/8: 沟通风格 — 3个场景问题（Slider 1-5：你更喜欢主动聊天还是被搭讪？正式还是随性？直接还是委婉？）
Step 6/8: 关系意图 — 单选（认真交往/随缘/交友/不确定）
Step 7/8: 匹配偏好 — 期望性别（多选）、年龄范围（RangeSlider）、距离（Slider）
Step 8/8: 确认 — 展示所有填写信息的摘要卡片，确认提交按钮
```

UI 规范：
- 顶部: 进度条 (LinearProgressIndicator)，显示当前步骤 (e.g., "3/8")
- 内容区: 单一步骤的交互组件
- 底部: "上一步" (TextButton) + "下一步" (Button, 品牌色)
- 最后一步底部为: "上一步" + "确认并创建分身" (Button)
- 整体包在 Scaffold 内，带 TopAppBar 显示 "创建我的分身"

ViewModel:
```kotlin
@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {
    data class OnboardingData(
        val nickname: String = "",
        val gender: String = "",
        val birthYear: Int = 2000,
        val city: String = "",
        val education: String = "",
        val occupation: String = "",
        val interests: List<String> = emptyList(),
        val styleAnswers: Map<String, Int> = emptyMap(),
        val relationshipIntent: String = "",
        val matchGenderPrefs: List<String> = emptyList(),
        val matchAgeMin: Float = 18f,
        val matchAgeMax: Float = 35f,
    )

    private val _currentStep = MutableStateFlow(0)
    val currentStep: StateFlow<Int> = _currentStep

    private val _data = MutableStateFlow(OnboardingData())
    val data: StateFlow<OnboardingData> = _data

    private val _isSubmitting = MutableStateFlow(false)
    val isSubmitting: StateFlow<Boolean> = _isSubmitting.asStateFlow()

    fun nextStep() { if (_currentStep.value < 7) _currentStep.value++ }
    fun prevStep() { if (_currentStep.value > 0) _currentStep.value-- }

    fun submit() {
        viewModelScope.launch {
            _isSubmitting.value = true
            try {
                // POST /onboarding/finalize 或等效端点
                // 成功后导航到主页面
            } catch (e: Exception) {
                // 错误处理
            } finally { _isSubmitting.value = false }
        }
    }
}
```

【约束】
- 使用 HorizontalPager (accompanist 或 Foundation pager)
- 保留表单数据在 Activity 重建时（ViewModel + SavedStateHandle）
- 步骤间切换不丢失已填写数据
- 第 8 步确认页使用 Card 组件展示各字段摘要
```

---

### Phase 2.3: 对话界面 (Conversation/Chat)

**目标**: 实现 Agent Session 的对话消息界面。

**AI 执行提示词**:

```
你是 Echo Android 项目的 Compose 工程师。请实现 Agent Session 对话界面。

【背景需求 PRD FR-054】
用户应能在活动日志中查看完整的会话记录。当前 Android 端完全没有对话/conversation 屏幕。
后端 API: 目前 EchoApi.kt 中没有 sessions/messages 端点，需要同步添加。

【任务1: 扩展 EchoApi.kt】
路径: `app/src/main/java/com/echo/app/data/api/EchoApi.kt`

添加以下端点：
```kotlin
@GET("sessions")
suspend fun getSessions(): List<SessionDto>

@GET("sessions/{sessionId}/messages")
suspend fun getMessages(@Path("sessionId") sessionId: String): List<MessageDto>
```

同时在 `dto/` 下新建 `SessionDtos.kt`:
```kotlin
data class SessionDto(
    val id: String,
    val clone_a_id: String,
    val clone_b_id: String,
    val status: String,
    val started_at: String,
    val other_user_name: String = "对方",
)

data class MessageDto(
    val id: String,
    val speaker_clone_id: String,
    val content: String,
    val turn_index: Int,
    val created_at: String,
)
```

【任务2: 新建 ConversationListScreen.kt】
路径: `app/src/main/java/com/echo/app/ui/screens/conversation/ConversationListScreen.kt`

会话列表界面：
- LazyColumn 展示所有活跃会话
- 每个会话卡片显示: 对方名字、最后一条消息预览（最多50字）、时间
- 点击进入 ConversationDetailScreen
- 空状态: "暂无对话，去广场看看？" + 跳转按钮

【任务3: 新建 ConversationDetailScreen.kt + ConversationViewModel.kt】
路径: 
- `app/src/main/java/com/echo/app/ui/screens/conversation/ConversationDetailScreen.kt`
- `app/src/main/java/com/echo/app/ui/screens/conversation/ConversationViewModel.kt`

聊天详情界面（只读，因为对话由 Agent 自动进行）：
- LazyColumn 展示消息列表，自动滚动到底部
- 消息气泡: 左侧灰色（对方分身），右侧品牌粉色（我的分身）
- 每条消息显示时间戳和发送者标识
- TopAppBar: 标题=对方名字，back button
- 当新消息到达时（通过 FCM 或轮询）自动刷新列表

ViewModel:
```kotlin
@HiltViewModel
class ConversationViewModel @Inject constructor(
    private val api: EchoApi
) : ViewModel() {
    private val _messages = MutableStateFlow<List<MessageDto>>(emptyList())
    val messages: StateFlow<List<MessageDto>> = _messages

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    fun loadMessages(sessionId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                _messages.value = api.getMessages(sessionId)
            } catch (e: Exception) {
                // error handling
            } finally { _isLoading.value = false }
        }
    }
}
```

【任务4: 集成到导航】
在 EchoNavHost.kt 中添加:
- `composable("conversations")` → 会话列表
- `composable("conversations/{sessionId}")` → 聊天详情
- 将 ActivityScreen 改为导航到会话列表而非显示占位符

【约束】
- 对话为只读模式（Agent 自动对话，用户不直接输入）
- 使用 LazyColumn + `rememberLazyListState()` 实现自动滚动
- 消息时间格式: "HH:mm" (今天) 或 "MM-dd HH:mm" (更早)
- 遵循 Material3 设计规范
```

---

### Phase 2.4: Handoff UI + Activity/Audit + Report + Clone Edit

这四个是 P1-09/P1-10/P1-11/P1-04b/04c 的组合，可在一个阶段内并行完成。

**AI 执行提示词**:

```
你是 Echo Android 项目的 Compose 工程师。请实现以下四个缺失界面：

【任务1: HandoffScreen.kt】
路径: `app/src/main/java/com/echo/app/ui/screens/handoff/HandoffScreen.kt`

Handoff 接受/拒绝界面（对应 PRD P1-09）：
- 顶端大卡片展示对方基本信息（名字、城市、匹配度）
- 中间显示 Agent 间的对话摘要（最近 5 条消息）
- 底部两个按钮: "接受 Handoff"（品牌色）和 "婉拒"（灰色 OutlinedButton）
- 接受后: 调用 POST /handoff/{id}/accept，导航到真实对话
- 拒绝后: 调用 POST /handoff/{id}/decline，返回匹配列表

HandoffViewModel:
```kotlin
@HiltViewModel
class HandoffViewModel @Inject constructor(
    private val api: EchoApi
) : ViewModel() {
    fun accept(handoffId: String) { /* ... */ }
    fun decline(handoffId: String) { /* ... */ }
}
```

相应的 API 端点需要在 EchoApi.kt 中添加（参考已有 HandoffDtos.kt）。

【任务2: ActivityScreen 从占位符升级】
路径: `app/src/main/java/com/echo/app/ui/screens/activity/ActivityScreen.kt`

将当前占位符改为实际功能：
- LazyColumn 展示用户活动时间线
- 活动类型: 收到匹配推荐 / Agent开始对话 / Handoff通知 / 分身更新
- 每个条目: 图标 + 标题 + 时间 + 描述
- API: `GET /activity` (需在 EchoApi.kt 中添加)

ActivityViewModel:
```kotlin
data class ActivityItem(val type: String, val title: String, val description: String, val time: String)
// 从 API 获取活动列表
```

【任务3: ReportScreen.kt】
路径: `app/src/main/java/com/echo/app/ui/screens/report/ReportScreen.kt`

举报界面（对应 PRD P1-11）：
- 举报对象显示（从路由参数获取 userId 或 sessionId）
- 举报原因选择: 骚扰/不当内容/虚假信息/其他（单选 ChipGroup）
- 详细描述 TextField（多行）
- 提交按钮
- API: `POST /reports` (需在 EchoApi.kt 中添加)
  ```kotlin
  @POST("reports")
  suspend fun submitReport(@Body req: ReportRequest): ReportResponse
  ```

ReportViewModel 处理提交状态和成功/失败提示。

【任务4: CloneEditScreen.kt】
路径: `app/src/main/java/com/echo/app/ui/screens/clone/CloneEditScreen.kt`

分身编辑界面（对应 PRD P1-04b/04c）：
- Persona Prompt 编辑: 多行 TextField，显示当前值，可编辑保存
- 社交边界配置:
  - 禁用词列表: 每行一个词，可添加/删除
  - 回避话题: 多选 ChipGroup（政治/宗教/收入/前任/其他）
- 保存按钮调用 `PUT /clones/me`
- 在 CloneScreen.kt 中添加 "编辑分身" 按钮导航到此页面

API 端点（需在 EchoApi.kt 中添加）:
```kotlin
@PUT("clones/me")
suspend fun updateClone(@Body req: UpdateCloneRequest): CloneDto
```

在 CloneDtos.kt 中添加:
```kotlin
data class UpdateCloneRequest(
    val persona_prompt: String? = null,
    val forbidden_words: List<String>? = null,
    val topics_to_avoid: List<String>? = null,
)
```

【集成到导航】
在 EchoNavHost.kt 中添加所有新路由:
- `composable("handoff/{handoffId}")`
- `composable("report/{targetType}/{targetId}")`  
- `composable("clone/edit")`

【约束】
- 所有 API 端点先用 mock 实现（在 EchoApi.kt 中标记 @Mock 注释），等待后端就绪
- 页面间通过 Navigation 传参，不使用全局状态
- 每个页面独立 ViewModel（@HiltViewModel）
- 遵循现有 strings.xml 字符串资源
```

---

### Phase 2.5: P1-15 Release APK 签名 + CI

**目标**: 配置 release 构建和签名。

**AI 执行提示词**:

```
你是 Echo Android 项目的 DevOps 工程师。请配置 Release APK 签名和 CI 构建。

【任务1: 配置签名密钥库】

> **⚠️ 路径关键：Echo 是 monorepo。Android Gradle 根目录是 `apps/android/`**
> （`settings.gradle.kts` 在此目录下，`rootProject.file(...)` 解析相对路径以此为基准）
> 以下所有"项目根目录"均指 `apps/android/`，不是仓库根 `Echo/`。

1. 在 `apps/android/` 下生成密钥库:
   ```bash
   cd apps/android
   keytool -genkey -v -keystore echo-release.jks -keyalg RSA \
     -keysize 2048 -validity 10000 -alias echo-release
   ```
2. 在 `apps/android/` 下创建 `keystore.properties`（不要提交到 Git）:
   ```properties
   storeFile=echo-release.jks
   storePassword=YOUR_STORE_PASSWORD
   keyAlias=echo-release
   keyPassword=YOUR_KEY_PASSWORD
   ```
3. 确认 `apps/android/.gitignore` 包含以下行（如不存在则创建）:
   ```
   echo-release.jks
   keystore.properties
   ```

【任务2: 修改 apps/android/app/build.gradle.kts】
路径: `apps/android/app/build.gradle.kts`

在 android 块中添加读取密钥库配置:
```kotlin
android {
    // ... 现有配置 ...

    val keystorePropertiesFile = rootProject.file("keystore.properties")
    val keystoreProperties = Properties()
    if (keystorePropertiesFile.exists()) {
        keystoreProperties.load(FileInputStream(keystorePropertiesFile))
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            // debug 保持原有配置
        }
    }
}
```

【任务3: 创建 ProGuard 规则】
路径: `apps/android/app/proguard-rules.pro`

```
# Retrofit
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.echo.app.data.api.dto.** { *; }
-dontwarn okhttp3.**
-dontwarn retrofit2.**

# Moshi
-keep class com.squareup.moshi.** { *; }
-keep @com.squareup.moshi.JsonQualifier interface *

# Hilt
-keep class dagger.hilt.** { *; }

# Keep R8 from stripping Echo data classes
-keep class com.echo.app.** { *; }
```

【任务4: 修改 CI 配置】
路径: `Echo/.github/workflows/android-apk.yml`（仓库根 `.github` 目录）

在现有 debug 构建之外添加 release job。
注意：所有 Gradle 命令需在 `apps/android/` 目录下执行（或使用 `-p` 参数）:
```yaml
- name: Build Release APK
  working-directory: apps/android
  run: ./gradlew assembleRelease
- name: Upload Release APK
  uses: actions/upload-artifact@v4
  with:
    name: echo-release-apk
    path: apps/android/app/build/outputs/apk/release/app-release.apk
```

【约束】
- 密钥库密码等敏感信息通过 GitHub Secrets 注入 CI，不硬编码
- 非 CI 环境（本地构建）读 `apps/android/keystore.properties` 文件
- ProGuard 规则必须覆盖 Retrofit、Moshi、Hilt 的数据类
- `rootProject.file("keystore.properties")` 解析到 `apps/android/keystore.properties`（因为 `settings.gradle.kts` 在此目录）
```

---

## G3: 目标设计-实现断层 — 4 阶段修复

### 现状诊断

```
Agent Platform 模块状态:
  M1 Composer:      ✅ 代码存在 | ⚠️ 部分接线 (缺L3-L6)
  M2 Style Engine:  ✅ 已生成 | ❌ 未被 agent-turn 消费
  M3 TopicJudge:    ✅ 独立服务存在 | ❌ 被 UnifiedAnalysis 替代
  M4 SocialMemory:  ✅ 提取+写入 | ❌ L6 检索未接线
  M5 PromoteCheck:  ✅ 已接线
  M6 Affection:     ✅ 全部接线 (apply + overlay + decay)
  M7 Evals:         ✅ 独立测试套件

关键断点: main.ts L290
  composeSystemPrompt({ persona, boundaryClause, affectionOverlay })
  缺少: profileCore (L3), selfMemory (L4-L5), socialMemory (L6)
```

---

### Phase 3.1: 接线 L3 — profileCore (Style.md 注入)

**目标**: 将 M2 Style Engine 生成的 style.md 注入系统提示词。

**涉及文件**:
- `services/worker/src/main.ts`（agent-turn handler, ~L280-290）
- `services/worker/src/agent-platform/composer/prompt-composer.ts`（已支持 profileCore 参数）

**AI 执行提示词**:

```
你是 Echo 项目的后端工程师。请将 M2 Style Engine 的输出注入到 agent-turn 的系统提示词中。

【问题】
M2 Style Engine (`services/api/src/agent-platform/style/style-generator.service.ts`) 在入驻完成时生成了 `style.md` 并存储到 `profile.styleMd` 字段。但 `services/worker/src/main.ts` 中的 agent-turn 处理函数（L290）在调用 `composeSystemPrompt` 时从未从数据库读取 style.md，导致 M2 生成的风格指导对实际对话无任何影响。

【修改位置: services/worker/src/main.ts】

在 agent-turn 处理函数中（约 L240-L290 区域，具体为读取 persona prompt 之后、调用 composeSystemPrompt 之前），添加 style.md 的读取和 profileCore 的注入：

```typescript
// --- 新增：M2 Style Engine — L3 profileCore 注入 ---
let profileCore: string | undefined;
try {
  const profile = await prisma.profile.findUnique({
    where: { userId: otherSpeaker.userId },
    select: { styleMd: true },
  });
  if (profile?.styleMd) {
    profileCore = `沟通风格:\n${profile.styleMd}`;
  } else {
    logger.debug('no style.md for user', { userId: otherSpeaker.userId });
  }
} catch (err) {
  logger.warn('failed to read style.md for L3 profileCore', {
    error: err instanceof Error ? err.message : String(err),
    userId: otherSpeaker.userId,
  });
}
// --- 新增结束 ---

// 修改 L290 的 composeSystemPrompt 调用：
const systemPrompt = composeSystemPrompt({
  persona,
  boundaryClause,
  affectionOverlay,
  profileCore,      // ← 新增：L3 画像核心
});
```

【要点说明】
1. `profileCore` 来源于 `otherSpeaker.userId`（对方分身的用户ID），因为系统提示词是发给 **说话分身** 的，需要注入 **对方用户** 的画像信息。
2. `style.md` 可能为空（旧用户未入驻时），使用 undefined 而非空字符串，composer 中有 `if (profileCore)` 检查。
3. 日志分级：style.md 缺失用 debug，读取失败用 warn。
4. 不修改 prompt-composer.ts（它已经支持 profileCore 参数，L41 和 L66）。
```

---

### Phase 3.2: 接线 L6 — socialMemory 检索回注

**目标**: 将已提取的社交记忆（facts + preferences）在每轮对话时检索并注入系统提示词。

**涉及文件**:
- `services/worker/src/main.ts`（agent-turn handler）
- `services/worker/src/agent-platform/memory/social-extract.service.ts`（L177-188 已有 getKnownAttributes 方法）
- `services/worker/src/agent-platform/composer/prompt-composer.ts`（已支持 socialMemory 参数）

**AI 执行提示词**:

```
你是 Echo 项目的后端工程师。请实现 L6 社交记忆检索，将已提取的 facts/preferences 注入 agent-turn 系统提示词。

【问题】
`runM5M6Unified()` 函数在每轮对话后正确地将社交事实和偏好写入文件系统：
```
tmp/memory/users/{observerId}/social/by_agent/{otherId}/objective_facts.jsonl
tmp/memory/users/{observerId}/social/by_agent/{otherId}/preferences.jsonl
```

但这些文件**从未被读取回系统提示词**。`SocialExtractService.getKnownAttributes()` 方法（social-extract.service.ts L177-188）存在但从未被调用。导致 Agent 不知道之前的对话中已经了解到的对方信息。

【修改位置: services/worker/src/main.ts】

在 agent-turn 处理函数中（profileCore 读取之后、composeSystemPrompt 调用之前），添加 socialMemory 检索：

```typescript
// --- 新增：M4 L6 — socialMemory 检索回注 ---
let socialMemory: string | undefined;
try {
  const socialExtract = new SocialExtractService(getMemoryBaseDir());
  const knownAttrs = await socialExtract.getKnownAttributes(
    speakerId,        // observerId = 说话分身的ID
    otherSpeakerId,   // otherId = 对方分身的ID
  );
  if (knownAttrs && knownAttrs.length > 0) {
    socialMemory = knownAttrs.join('\n');
  }
} catch (err) {
  logger.warn('failed to retrieve social memory for L6', {
    error: err instanceof Error ? err.message : String(err),
    speakerId,
    otherSpeakerId,
  });
}
// --- 新增结束 ---

// 修改 composeSystemPrompt 调用：
const systemPrompt = composeSystemPrompt({
  persona,
  boundaryClause,
  affectionOverlay,
  profileCore,       // Phase 3.1
  socialMemory,      // ← 新增：L6 社会记忆
});
```

【需要同步添加的 import】
在 main.ts 顶部添加：
```typescript
import { SocialExtractService } from './agent-platform/memory/social-extract.service';
```

【SocialExtractService.getKnownAttributes 参考】
该方法位于 `services/worker/src/agent-platform/memory/social-extract.service.ts` L177-188。请确保：
1. 它的返回值格式与 prompt-composer.ts 中的 socialMemory 参数兼容（string | undefined）
2. 如果方法不存在或签名不同，请先读取该文件确认实际签名，然后适配
3. 如果文件路径需要调整，使用正确的 `getMemoryBaseDir()` 导入

【约束】
- 不修改 prompt-composer.ts（L68 已支持 socialMemory 参数）
- 日志正确分级（已知属性缺失用 debug，读取失败用 warn）
- 如果 `getKnownAttributes` 返回空数组，socialMemory 为 undefined，composer 会跳过 L6
```

---

### Phase 3.3: 恢复 M3 TopicJudge 开场阶段逻辑

**目标**: 修复 UnifiedAnalysis 中缺失的开场阶段逻辑，防止 Agent 在已获取信息时重复提问。

**涉及文件**: `services/worker/src/agent-platform/merged/unified-analysis.service.ts`

**AI 执行提示词**:

```
你是 Echo 项目的后端工程师。请修复 UnifiedAnalysisService 中缺失的 M3 开场阶段逻辑。

【问题】
独立的 TopicJudgeService (`agent-platform/topic/topic-judge.service.ts` L13-18) 包含关键的开场阶段逻辑：
```
// opening 阶段必须遵守，L6 memory 优先级最高：
// - 如果 known_social_memory 中已有姓名（name）或职业（occupation），
//   则视为信息已收集，禁止仅因 opening 规则而强制 continue_main
```

但 UnifiedAnalysisService (`agent-platform/merged/unified-analysis.service.ts`) 的 topic 分析 prompt 中**没有这个逻辑**。这意味着即使用户已经在之前的对话中说过了姓名和职业，Agent 仍可能在 "开场阶段" 重复询问这些信息，造成体验极差。

【修改文件: services/worker/src/agent-platform/merged/unified-analysis.service.ts】

1. 首先读取 `topic-judge.service.ts` 的完整内容以理解开场阶段逻辑
2. 读取 `unified-analysis.service.ts` 的完整 LLM prompt 部分
3. 在 UnifiedAnalysis 的 prompt 中，topic 分析部分增加以下约束：

在 topic 分析的 prompt 指令中（通常在 system message 或 user message 的 JSON schema 要求中），找到 topic 相关的要求并添加：

```
# Topic Analysis Rules

## Opening Phase (opening) — CRITICAL
- The opening phase is for gathering basic information: name, occupation, location, interests.
- BEFORE deciding that the conversation should stay in "opening" phase:
  * Check the LAST 4 agent messages: if the agent has ALREADY asked about
    name/occupation/location/interests and received answers, DO NOT ask again.
  * Known facts from the conversation history take priority over opening rules.
- Transition to "continue_main" when:
  * At least 2 basic facts (name, occupation, or interests) are known, OR
  * The agent has asked 3 opening questions without receiving new information, OR
  * The user/other agent has introduced a specific topic.
```

4. 在 JSON 输出的 schema 中（如果使用 structured output），确保 topic.type 字段严格遵循上述规则。

【测试检查点】
- 场景: 对方已说 "我叫小明，是程序员"
- 期望: 下一步不至于继续问 "你叫什么名字？做什么工作？"
- 期望: 应自然过渡到 continue_main，基于已知信息展开话题

【约束】
- 只修改 unified-analysis.service.ts，不动 topic-judge.service.ts
- 保持 unified prompt 的 JSON 输出格式不变
- 注意 token 预算（新增规则应控制在 200 tokens 以内）
```

---

### Phase 3.4: 端到端集成测试 + 回退安全

**目标**: 验证三个接线后的系统行为，确保不引入回归。

**AI 执行提示词**:

```
你是 Echo 项目的 QA 工程师。请编写端到端验证脚本来确认 G3 修复生效。

【任务背景】
经过 Phase 3.1-3.3 的修改，agent-turn 的系统提示词现在应包含：
- L3 profileCore (style.md)
- L6 socialMemory (已知事实和偏好)
- M3 开场阶段改进逻辑

【任务: 编写集成验证脚本】

创建文件: `services/worker/src/agent-platform/__tests__/agent-turn-composer-integration.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { composeSystemPrompt } from '../composer/prompt-composer';

describe('agent-turn composer integration', () => {
  const baseOpts = {
    persona: '测试人格：幽默风趣，喜欢开玩笑',
    boundaryClause: '不要讨论政治和宗教',
  };

  it('should include L3 profileCore when provided', () => {
    const prompt = composeSystemPrompt({
      ...baseOpts,
      profileCore: '沟通风格：主动搭讪型，喜欢用表情包',
    });
    expect(prompt).toContain('沟通风格：主动搭讪型');
    expect(prompt).toContain('profile.core');
  });

  it('should include L6 socialMemory when provided', () => {
    const prompt = composeSystemPrompt({
      ...baseOpts,
      socialMemory: '已知对方姓名：小明\n已知对方职业：程序员\n已知对方爱好：打篮球',
    });
    expect(prompt).toContain('小明');
    expect(prompt).toContain('程序员');
    expect(prompt).toContain('打篮球');
    expect(prompt).toContain('social-memory');
  });

  it('should include M6 affection overlay when provided', () => {
    const prompt = composeSystemPrompt({
      ...baseOpts,
      affectionOverlay: '当前亲密度: 60/100，关系: 刚认识',
    });
    expect(prompt).toContain('亲密度');
    expect(prompt).toContain('刚认识');
  });

  it('should include ALL layers when all provided', () => {
    const prompt = composeSystemPrompt({
      persona: '测试人格',
      boundaryClause: '不要讨论政治',
      profileCore: '风格：活泼',
      socialMemory: '已知：姓名-小红',
      affectionOverlay: '亲密度：50',
    });
    // 验证所有层都存在且顺序正确
    const indexOf = (substr: string) => prompt.indexOf(substr);

    // L0 safety 应在最前面
    expect(indexOf('safety') >= 0 || prompt.length > 0).toBe(true);
    // L2 persona 应在 L3 之前
    expect(indexOf('测试人格')).toBeLessThan(indexOf('风格：活泼'));
    // L6 应在 L3 之后
    expect(indexOf('风格：活泼')).toBeLessThan(indexOf('小红'));
    // M6 应在 L2 之后
    expect(indexOf('测试人格')).toBeLessThan(indexOf('亲密度'));
  });

  it('should NOT include L3 when profileCore is undefined', () => {
    const prompt = composeSystemPrompt({ ...baseOpts });
    expect(prompt).not.toContain('profile.core');
  });

  it('should NOT include L6 when socialMemory is undefined', () => {
    const prompt = composeSystemPrompt({ ...baseOpts });
    expect(prompt).not.toContain('social-memory');
  });
});
```

【运行方式】
```bash
cd services/worker && npx vitest run src/agent-platform/__tests__/agent-turn-composer-integration.test.ts
```

【约束】
- 使用 vitest（项目已有）
- 测试覆盖所有组合：仅 L3、仅 L6、L3+L6、全部层、无可选层
- 不依赖外部文件和数据库，纯单元测试
```

---

## 执行优先级矩阵

按影响范围和依赖关系排序：

| 优先级 | 断层 | 阶段 | 理由 |
|--------|------|------|------|
| 🔴 P0 | G1 | Phase 1.1 | 修复匹配质量是最紧迫的（直接影响核心用户体验）|
| 🔴 P0 | G3 | Phase 3.1-3.3 | Agent对话质量是产品核心差异化（需要L3+L6+M3修复一起上）|
| 🟠 P1 | G1 | Phase 1.2-1.4 | 匹配增强（embedding丰富化+规则过滤）|
| 🟠 P1 | G2 | Phase 2.1 | 认证流程阻塞所有客户端功能 |
| 🟡 P2 | G2 | Phase 2.2-2.4 | 入驻+对话+Handoff+Report（可并行）|
| 🟡 P2 | G3 | Phase 3.4 | 验证修复有效 |
| 🟢 P3 | G2 | Phase 2.5 | Release APK（校园侧载关口）|

---

## 附录: 关键代码位置速查

| 问题 | 文件 | 行号 |
|------|------|------|
| fakeEmbedding 定义 (API) | `services/api/src/llm/llm.service.ts` | L122-128 |
| fakeEmbedding 定义 (Worker) | `services/worker/src/clone-runtime/llm.ts` | L80-86 |
| Embedding 文本构建 | `services/api/src/onboarding/onboarding.service.ts` | L236-243 |
| Embedding 写入 | `services/api/src/onboarding/onboarding.service.ts` | L257-264 |
| 匹配引擎 (生产) | `services/worker/src/clone-runtime/match-bridge.ts` | L9-55 |
| 匹配引擎 (冗余) | `services/api/src/matches/matches.service.ts` | L108-152 |
| FR-040/041 | `docs/PRD-Echo.md` | L274-275 |
| Composer 调用 (断点) | `services/worker/src/main.ts` | L290 |
| Composer 接口 | `services/worker/src/agent-platform/composer/prompt-composer.ts` | L37-48 |
| Style.md 生成 | `services/api/src/agent-platform/style/style-generator.service.ts` | 全文件 |
| Style.md 存储 | `services/api/src/onboarding/onboarding.service.ts` | L207-222 |
| SocialExtract.getKnownAttributes | `services/worker/src/agent-platform/memory/social-extract.service.ts` | L177-188 |
| TopicJudge 开场逻辑 | `services/worker/src/agent-platform/topic/topic-judge.service.ts` | L13-18 |
| UnifiedAnalysis prompt | `services/worker/src/agent-platform/merged/unified-analysis.service.ts` | 全文件 |
| Android P1-14/P1-15 | `docs/Phase1-Demo-Roadmap-Echo.md` | L97-98 |
| Agent Platform 里程碑 | `docs/agent-platform/implementation-milestones.md` | 全文件 |
