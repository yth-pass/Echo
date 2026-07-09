# M7 — 评估架构

| 字段 | 值 |
|-------|-------|
| **关联文档** | [implementation-milestones.md](../agent-platform/implementation-milestones.md), [mechanisms.md](../agent-platform/mechanisms.md), [storage-schema.md](../agent-platform/storage-schema.md), [Deployment-and-Component-Boundaries-Echo.md](../Deployment-and-Component-Boundaries-Echo.md) |
| **状态** | 草案 |
| **机制** | #21 |

> 本文是 `docs/agent-platform/M7-Evals-Architecture.md` 的简体中文镜像。若存在差异，以英文原版为准。
> Schema 与 API 路径、代码标识符、`FR-xxx` 编号保持不变。

---

## 0. 路径决策：`evals/` 放在哪里

### 两个候选位置

| 选项 | 路径 | 性质 |
|------|------|------|
| A | `shared-agent/evals/` | 仓库根级别的共享数据资产 |
| B | `services/worker/src/agent-platform/evals/` | 与 Worker 代码同目录 |

### 决策：**按关注点分离 — 两处都放，各司其职**

```
shared-agent/evals/                          ← 黄金数据（纯 JSON/YAML）
  ├── golden/          # 权威对话转录
  ├── fixtures/        # 可复用的设置模板（profile、style、memory 快照）
  └── schemas/         # eval-case.schema.json（单一权威来源）

services/worker/src/agent-platform/evals/    ← 运行器代码（TypeScript）
  ├── runners/         # 评估执行引擎
  ├── assertions/      # 断言模块（规则 + LLM judge 适配器）
  ├── reports/         # 本地报告输出（gitignored）
  └── migrate/         # smoke-test → eval-case 适配器（一次性）
```

**理由：**

1. **黄金数据可共享。** 同一套 `shared-agent/evals/golden/` 对话是所有层（Worker、未来的 API smoke、未来的 APK e2e）的单一权威来源。放在 `services/worker/` 内部会把它埋没。

2. **运行器需要模块访问权限。** 评估运行器必须 `import { TopicJudgeService } from '../topic/topic-judge.service'` 等。这只能从 `services/worker/` 内部工作。根据层归属矩阵（里程碑 M7 行 = 仅 Worker），运行器是 Worker 层的代码。

3. **Schema 权威性。** `eval-case.schema.json` 位于 `shared-agent/evals/schemas/` 作为权威 schema。Worker 侧代码对其进行验证，但不拥有它——这遵循不变量 #8（`docs/agent-platform/schemas/` 中的 schema 是权威的）。eval case schema 在 `shared-agent/evals/schemas/` 中有自己的权威位置，并在 `docs/agent-platform/schemas/` 中有镜像。

4. **与 `shared-agent/` 设计一致。** `shared-agent/` 目录已经承载了 `SKILL.md`、`references/` 和 `scripts/`。在此处添加 `evals/` 与 storage-schema.md 树和机制 #1（"共享技能基础 = shared-agent/SKILL.md + references + scripts + evals"）一致。

5. **最小差异。** 无现有文件移动。只有新增目录 `shared-agent/evals/` 和 `services/worker/src/agent-platform/evals/`。现有的 `affection/`、`topic/`、`memory/`、`composer/` 中的 smoke test 保留不变（它们仍然是面向开发者的快速检查；它们被映射到 eval case，不会被删除）。

---

## 1. Eval Case JSON Schema

### 1.1 权威 schema

**位置：** `shared-agent/evals/schemas/eval-case.schema.json`

（与英文版相同的 JSON Schema，此处省略重复。详见 `docs/agent-platform/schemas/eval-case.schema.json`。）

### 1.2 字段语义

| 字段 | 用途 | 约束 |
|-------|---------|-------------|
| `id` | 稳定、不可重用的 case 编号 | 格式：`EVAL-001` 到 `EVAL-999`。分配后永不重新编号。 |
| `mechanism` | 测试哪个子系统 | 必须匹配五个枚举值之一。决定加载哪些服务。 |
| `tags` | CI 维度分类 | 必须至少包含 `style`、`memory-leak`、`hearsay`、`topic-return` 之一。其他标签用于筛选。 |
| `setup` | 前置条件状态 | `memorySnapshot` 将 fixture JSON 加载到临时存储。`affectionSeed` 在不运行完整提取管线的情况下预热关系状态。 |
| `input` | 刺激输入 | `turns` 是要回放的对话转录。`goldenRef` 允许使用简短的触发消息和独立的完整转录。 |
| `assertions` | 验证内容 | 每个断言有一个 `target`（来自封闭枚举）。`rule` 断言在确定性层中运行；`llm-judge` 断言仅在 LLM 层中运行。 |
| `requiresLlm` | 是否需要 LLM API | 控制 CI 层路由。如果为 `true`，case 在确定性层中被跳过。 |
| `expectedDurationMs` | 性能预算 | 供 CI 使用，提前对慢速 case 报错。 |
| `sourceSmokeTest` | 来源追踪 | 迁移审计追踪。 |

### 1.3 示例：一个真实的 eval case

```json
{
  "id": "EVAL-001",
  "mechanism": "composer",
  "tags": ["style", "smoke"],
  "description": "验证 L0 安全规则始终出现在组合提示中，且不能被 L2 角色覆盖。",
  "requiresLlm": false,
  "expectedDurationMs": 500,
  "sourceSmokeTest": "services/worker/src/agent-platform/composer/smoke-test.ts",
  "setup": {
    "observers": ["agent-a"],
    "memorySnapshot": "none"
  },
  "input": {
    "turns": [
      { "speaker_id": "user-x", "content": "你好", "turn_index": 0 }
    ]
  },
  "assertions": [
    {
      "assertType": "rule",
      "target": "composer-output-contains",
      "expect": { "pattern": "L0.*always overrides", "caseSensitive": false },
      "severity": "blocking"
    },
    {
      "assertType": "rule",
      "target": "composer-output-contains",
      "expect": { "pattern": "绝对最高优先级", "caseSensitive": false },
      "severity": "blocking"
    },
    {
      "assertType": "rule",
      "target": "composer-token-budget",
      "expect": { "layer": "L0+L1", "maxTokens": 800 },
      "severity": "blocking"
    },
    {
      "assertType": "rule",
      "target": "composer-layer-order",
      "expect": { "layers": ["L0", "L1", "L2", "L8"] },
      "severity": "blocking"
    }
  ]
}
```

---

## 2. 目录树与命名规范

（目录树结构与英文版相同，此处省略。详见第 2 节的 ASCII 树。）

### 2.3 为什么黄金文件使用 YAML？

黄金对话文件使用 **YAML**（而非 JSON），因为：

1. **多行对话内容可读。** 包含中文文本、换行和特殊字符的聊天转录受益于 YAML 块标量（`|`）。
2. **允许注释。** 黄金 case 需要注释来解释每个断言存在的原因以及它防范什么回归。
3. **内联 JSON 断言。** 每个 YAML 黄金文件中的 `assertions` 数组是 JSON（嵌入的），保持机器可验证性，同时周围上下文保持人类可读。

---

## 3. 四类断言：检测策略

### 3.1 概览矩阵

| 维度 | 规则检测（确定性层） | LLM Judge（LLM 层） | 比例（规则:LLM） |
|-----------|-------------------------------|---------------------|-------------------|
| **风格** | 模式匹配、token 计数、层排序 | 与 persona 的语义风格对齐 | 70:30 |
| **记忆泄露** | share_policy 字段检查、observer 隔离、PII 正则 | 语义检查：输出中是否泄露了隐私信息？ | 80:20 |
| **道听途说** | promote 状态检查、置信度阈值、②/① 分离 | 语义检查：推断是否被当作事实呈现？ | 85:15 |
| **话题返回** | transition 类型验证、子话题栈完整性、摘要长度 | 语义检查：回复是否自然地返回主话题？ | 75:25 |

### 3.2 风格一致性 (`tags: ["style"]`)

**验证内容：** Composer 输出符合 Echo 的角色、边界和安全规则。

#### 规则断言（确定性，每个 PR）

| 目标 | 策略 | 实现 |
|--------|----------|----------------|
| `composer-output-contains` | `output.includes(pattern)` | 快速字符串匹配。检查 L0 安全标记、L1 技能关键短语。 |
| `composer-output-not-contains` | `!output.includes(pattern)` | 禁止模式（例如 "I'm an AI"、破坏角色设定的通用免责声明）。 |
| `composer-token-budget` | `getLayerTokenEstimate(text)` ≤ 阈值 | 复用 `prompt-composer.ts` 中现有的 `getLayerTokenEstimate()`。逐层预算检查。 |
| `composer-layer-order` | 按顺序扫描输出中的层标记 | 正则：`/L0.*L1.*L2.*L\d/`。如果 L0 出现在 L1 之后则失败。 |

### 3.3 记忆泄露 (`tags: ["memory-leak"]`)

**验证内容：** 社交记忆提取不会泄露隐私数据或违反 share_policy。Observer 相对隔离得以维持。

#### 规则断言（确定性，每个 PR）

| 目标 | 策略 | 实现 |
|--------|----------|----------------|
| `memory-share-policy` | 检查所有提取事实的 `share_policy` 字段 | `share_policy: "never"` 的事实不得出现在任何输出层（Composer L4-L6）中。 |
| `memory-observer-isolation` | 比较 A→B 事实与 B→A 事实 | 联合会话后，A 对 B 的存储应不同于 B 对 A 的存储。仅共享双方显式确认的事实。 |
| `memory-no-pii` | 对提取的事实进行正则扫描 | 电话号码、身份证号、物理地址、银行账户不得出现在客观事实中，除非显式标记为可共享。 |

### 3.4 道听途说不作为事实 (`tags: ["hearsay"]`)

**验证内容：** 未确认的推断（②）不被视为既定事实（①）。实现不变量 #3。

#### 规则断言（确定性，每个 PR）

| 目标 | 策略 | 实现 |
|--------|----------|----------------|
| `hearsay-promote-status` | 检查事实状态字段 | ① 中的所有事实均为 `status: "active"` 且 `confidence >= 0.85`。② 中的所有偏好均为 `status: "candidate"` 或 `"promoted_to_objective"` 或 `"contradicted"`。 |
| `hearsay-confidence-threshold` | 强制置信度门槛 | 客观事实：`confidence >= 0.85`。偏好：`0.4 <= confidence <= 0.7`。 |
| `hearsay-not-in-objective-facts` | 验证 ②→① 升级审计追踪 | 当偏好具有 `status: "promoted_to_objective"` 时，对应的客观事实必须有 `promoted_from` 指回偏好 ID。 |

### 3.5 话题返回 (`tags: ["topic-return"]`)

**验证内容：** TopicJudge 正确识别过渡（尤其是离题后的 `return_to_main`）并维持子话题栈完整性。

#### 规则断言（确定性，每个 PR）

| 目标 | 策略 | 实现 |
|--------|----------|----------------|
| `topic-transition-type` | 验证 `TopicJudgeOutput.transition` | 每轮对话的期望过渡必须匹配黄金值。 |
| `topic-main-persists` | 检查 `current_topic.json.main_topic` 稳定性 | 只有 `new_main` 可以更改主话题。不变量 #4。 |
| `topic-subtopic-stack` | 验证 `subtopic_stack` 完整性 | `new_sub` → 栈增长；`return_to_main` → 栈收缩；栈永不为负。 |
| `topic-summary-length` | `summary.length <= 150` | 对生成的摘要字符串进行字符计数。M3 退出标准。 |

---

## 4. 现有 Smoke Test → Eval Case 迁移映射

完整的 JSON 映射表存储在 `services/worker/src/agent-platform/evals/migrate/smoke-to-eval-map.json`。

### 4.2 总 case 数

| 机制 | Cases | 已映射的现有 smoke test |
|-----------|-------|---------------------------|
| composer | 4 | 1 |
| topic | 4 | 3 |
| memory | 3 | 2 |
| hearsay | 3 | 1 (promote) |
| affection | 7 | 4 |
| cross-cutting | 4 | 2 (freechat + e2e) |
| **总计** | **25** | **11**（覆盖所有现有测试） |

### 4.3 Smoke test 退役计划

现有 smoke test 在 M7 开发期间**保留不变**。它们作为面向开发者的快速检查（`npx ts-node src/agent-platform/composer/smoke-test.ts`）。

**迁移路径：**
1. **阶段 1（M7 初始）：** 与现有测试并行创建 eval case。两者独立运行。
2. **阶段 2（M7 CI 集成）：** CI 运行 eval case。Smoke test 保留作为开发便利工具。
3. **阶段 3（M8+）：** 可选：将 smoke test 重构为 eval runner 的薄包装。M7 退出标准不要求此项。

---

## 5. CI 两档设计

### 5.2 第一档：确定性（每个 PR）

| 属性 | 值 |
|-----------|-------|
| **触发器** | `pull_request` 到 `main` |
| **运行器** | `deterministic-runner.ts` |
| **Cases** | 所有 `requiresLlm === false` 的 case |
| **断言** | 仅 `assertType === "rule"` |
| **API 调用** | 无（纯 TypeScript + 文件 I/O） |
| **超时** | 120 秒 |
| **结果** | PASS/FAIL（退出码 0/1） |
| **阻塞** | 是 — 合并被 FAIL 阻塞 |
| **报告** | JSON 输出到 `shared-agent/evals/reports/`（上传为 artifact） |

### 5.3 第二档：LLM Judge（main 合并 + 夜间）

| 属性 | 值 |
|-----------|-------|
| **触发器** | `push` 到 `main` + cron `0 2 * * *`（每日凌晨 2 点） |
| **运行器** | `llm-runner.ts` |
| **Cases** | 所有 case（包括 `requiresLlm === true`） |
| **断言** | `rule` 和 `llm-judge` 两种类型 |
| **API 调用** | DeepSeek API（通过 `DEEPSEEK_API_KEY` 环境变量） |
| **超时** | 600 秒 |
| **结果** | PASS/FAIL/WARN（PASS/WARN 退出码 0，FAIL 退出码 1） |
| **阻塞** | 否 — 仅告警（FAIL 时通过 Slack/邮件通知） |
| **报告** | JSON + Markdown 摘要 |

### 5.5 退出标准验证

M7 退出标准规定：**"故意回归时 CI 必须失败。"**

**验证程序：**
1. 取一个现有 PASS 的黄金 case（如 `EVAL-001`：L0 安全标记）。
2. 故意修改 `shared/safety.md` 移除 "L0 always overrides" 标记。
3. 运行确定性 CI → 必须 FAIL。
4. 还原修改 → CI 必须重新 PASS。
5. 对于 LLM 层：故意修改 `style.md` 使用冲突的角色语气。LLM judge 必须检测并报告。

此"红-绿-红"循环是 M7 的退出门槛。

---

## 6. Eval 执行链路（Mermaid 流程图）

（Mermaid 流程图与英文版相同，详见 `docs/agent-platform/M7-Evals-Architecture.md` 第 6 节。）

---

## 7. 非目标清单（M7 明确不做）

| # | 非目标 | 理由 | 归属 |
|---|----------|-----------|------------|
| 1 | **Eval 结果的 Web UI** | M7 仅限 Worker。报告是 JSON 文件。 | M8 或之后 |
| 2 | **Eval 存储的数据库迁移** | Eval 使用基于文件的黄金数据（`shared-agent/evals/`）和临时沙盒存储。无新 DB 表，无迁移。 | 不适用（设计如此） |
| 3 | **基于队列的 eval 执行** | M7 在 CI 中同步运行。用于异步 eval 管线的队列化（BullMQ）属于 M8 生产加固。 | M8 |
| 4 | **按用户 eval** | 机制 #21 明确声明"不按用户聊天"。Eval 是共享回归测试，非特定用户。 | 不适用（设计如此） |
| 5 | **Eval 覆盖率指标仪表板** | 覆盖率追踪属于 M8 的监控关注点。 | M8 |
| 6 | **从生产对话自动生成 eval case** | 黄金 case 是手工策划的。从真实聊天日志自动提取可能将 bug 编码为预期行为。 | M8 之后 |
| 7 | **Eval case 版本化/迁移框架** | 所有 case 共享单一 schema 版本。Schema 变更在 M7 开发期间通过手动迁移处理。 | M8 之后 |
| 8 | **跨矩阵并行 CI（OS/Node 版本）** | M7 CI 在单个 Linux 运行器上运行。跨平台矩阵属于 M8 加固。 | M8 |
| 9 | **Eval 结果作为阻塞部署门槛** | LLM 层是咨询性的（仅告警）。确定性层阻塞 PR 合并，但不阻塞部署。完整的 CI/CD 部署门槛属于 M8。 | M8 |
| 10 | **好感度评分的回归测试** | 好感度维度评分本质上是随机的（LLM 提取）。M7 覆盖确定性方面（标签过渡、overlay 格式、上限）。 | M8 之后 |
| 11 | **替换现有 smoke test** | Smoke test 保留作为开发便利工具。M7 在其旁添加 eval case。 | M8（可选） |

---

## 8. Echo Platform 不变量合规

- **Observer 相对模式**（#16）：测试社交记忆的 eval case 必须使用 observer 相对路径。
- **升级规则**（#3）：标记为 `hearsay` 的 eval case 验证 ②→① 管线。
- **好感度非阻塞**（#18）：测试好感度的 eval case 不要求好感度状态阻塞正常操作。断言验证 overlay 输出的正确性。
- **Schema 验证**（#8）：所有 eval case 文件在加载时根据 `eval-case.schema.json` 进行验证。
- **安全覆盖**（#7）：标记为 `style` 和 `memory-leak` 的 case 验证 L0 安全和 share_policy 约束不能被绕过。

---

## 9. 实施顺序

| 步骤 | 内容 | 文件 | 依赖 |
|------|------|-------|------------|
| 1 | 创建 `shared-agent/evals/` 目录 + schema | `shared-agent/evals/schemas/eval-case.schema.json` | 无 |
| 2 | 创建 `services/worker/.../evals/` 目录 + 类型 | `evals/types.ts`、`evals/index.ts` | 步骤 1 |
| 3 | 实现 `sandbox.ts`（临时目录 + fixture 加载器） | `evals/setup/sandbox.ts` | 步骤 2 |
| 4 | 实现 `rule-assertions.ts` | `evals/assertions/rule-assertions.ts` | 步骤 2 |
| 5 | 实现 `deterministic-runner.ts` | `evals/runners/deterministic-runner.ts` | 步骤 3, 4 |
| 6 | 编写第一个黄金 case（EVAL-001）+ 确定性运行 | `shared-agent/evals/golden/composer/style-l0-override.yml` | 步骤 5 |
| 7 | 实现 `llm-judge.ts` + `llm-runner.ts` | `evals/assertions/llm-judge.ts`、`evals/runners/llm-runner.ts` | 步骤 5 |
| 8 | 将所有 smoke test 迁移为 eval case | `evals/migrate/` + 黄金文件 | 步骤 7 |
| 9 | CI 集成（GitHub Actions 工作流） | `.github/workflows/evals.yml` | 步骤 8 |
| 10 | 红-绿-红验证（退出标准） | 不适用（手动） | 步骤 9 |

---

## 10. 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-----------|--------|------------|
| 黄金对话随平台演进变得过时 | 中 | 高 — 假阳性/假阴性 | Case 引用机制代码，而非输出哈希。规则断言检查结构（模式匹配、字段存在），而非精确字符串相等。LLM judge 评估语义正确性。 |
| LLM judge 是非确定性的 | 高 | 中 — CI 不稳定 | LLM 层是咨询性的（非阻塞）。夜间运行频率低。LLM judge 提示要求结构化的 YES/NO/PASS/FAIL 输出和明确标准。失败时重新运行以确认。 |
| 临时目录清理失败，CI 运行器磁盘填满 | 低 | 低 | 沙盒在 `ECHO_MEMORY_BASE_DIR` 下创建带时间戳前缀的目录。CI 运行器生命周期有限。清理始终运行（运行器中的 try/finally）。 |
| Eval 运行时间超过 CI 超时 | 中 | 中 | `expectedDurationMs` 字段作为早期预警。超过预算的 case 记录警告。CI 超时可通过 `EVAL_TIMEOUT_MS` 配置。 |
| `DEEPSEEK_API_KEY` 在 CI 中不可用 | 低 | 高 — LLM 层无法运行 | LLM 层仅为咨询性。确定性层覆盖 80%+ 的断言，无需 LLM。密钥缺失是记录的警告，而非 CI 失败。 |
