# M7 Eval Runner

Echo Agent Platform 的回归评测引擎。加载 JSON 格式的 eval case，在隔离沙箱中执行平台管线，运行断言并输出 pass/fail/skip 汇总。

## 确定性 Eval 套件 (Deterministic Suite)

13 条 case（含 1 条骨架 + 12 条业务验证），覆盖四类 CI 维度，零 LLM 调用，可在每 PR CI 中运行。

### Case 清单

| ID | 维度 | 机制 | 验证内容 |
|----|------|------|----------|
| EVAL-001 | style | composer | L0 safety markers |
| EVAL-002 | style | composer | L1 shared skill (约会分身) |
| EVAL-003 | style | composer | L8 output contract |
| EVAL-004 | style | composer | AI persona leak prevention |
| EVAL-005 | memory-leak | affection | Overlay privacy directive |
| EVAL-006 | memory-leak | memory | Observer-relative isolation |
| EVAL-007 | memory-leak | memory | share_policy schema validation |
| EVAL-008 | hearsay | memory | No premature fact promotion |
| EVAL-009 | hearsay | memory | Preference confidence/status schema |
| EVAL-010 | hearsay | memory | No duplicate ①/② facts |
| EVAL-011 | topic-return | topic | Offline fallback structure |
| EVAL-012 | topic-return | topic | State machine invariants |

### 验证回归探针

```bash
# 1. 启用回归探针
cp cases/deterministic/_EVAL-REGRESSION-PROBE.json.disabled cases/deterministic/EVAL-REGRESSION-PROBE.json

# 2. 运行 — 应看到 FAIL，exit code 1
npm run test:evals

# 3. 禁用
rm cases/deterministic/EVAL-REGRESSION-PROBE.json
```

### 按 tag 运行

```bash
npm run test:evals           # 全部 13 条 (exit 0)
npm run test:evals:style     # 仅 style (4 条)
npm run test:evals:memory    # 仅 memory-leak + hearsay (6 条)
```

```bash
cd services/worker

# 仅确定性断言（不需要 LLM，每次 PR 运行）
npm run test:evals

# 全部 case（需要 DEEPSEEK_API_KEY）
npm run test:evals:llm

# 按标签过滤
npm run test:evals:style     # 仅 style 维度
npm run test:evals:memory    # 仅 memory-leak + hearsay 维度
```

### 验证 fail 行为

```bash
# 1. 启用故意失败 case
cp cases/_dummy-fail.json.disabled cases/dummy-fail.json

# 2. 运行 — 应看到 FAIL，exit code 1
npm run test:evals

# 3. 恢复
rm cases/dummy-fail.json
```

## 目录结构

```
evals/
├── runners/
│   └── run-evals.ts          # 主入口：加载 → 过滤 → 执行 → 汇总
├── assertions/
│   └── assert-engine.ts      # 五个断言接口 + 路由分发
├── setup/
│   └── sandbox.ts            # 每 case 独立 tmp dir 生命周期
├── cases/
│   ├── dummy.json            # 骨架验证 case（零业务依赖）
│   └── *.json                # 你的 eval case 放这里
├── reports/                  # JSON 报告输出（gitignored）
└── README.md
```

## 如何新增一条 Eval Case

### 1. 创建 JSON 文件

在 `evals/cases/` 下新建 `EVAL-xxx.json`（编号见 `docs/agent-platform/M7-Evals-Architecture.md` 的迁移表）：

```json
{
  "id": "EVAL-001",
  "mechanism": "composer",
  "tags": ["style", "smoke"],
  "description": "验证 L0 安全层始终出现在组合 prompt 中",
  "requiresLlm": false,
  "setup": {
    "observers": ["agent-a"],
    "memorySnapshot": "none",
    "styleOverrides": {
      "agent-a": "温柔体贴的女声"
    }
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
      "expect": { "contains": ["L0 always overrides"] },
      "severity": "blocking"
    }
  ]
}
```

### 2. 必填字段

| 字段 | 说明 |
|------|------|
| `id` | 稳定标识符，格式 `EVAL-XXX`，永不重新编号 |
| `mechanism` | 被测子系统：composer / topic / memory / affection / cross-cutting |
| `tags` | 至少一个 CI 维度标签：style / memory-leak / hearsay / topic-return |
| `assertions` | 至少一条断言（见下方"断言类型"） |
| `requiresLlm` | true = 需要 LLM API，false = 纯规则 |

### 3. 运行验证

```bash
npm run test:evals
```

期望：你的新 case 出现在输出中，pass 或 fail 取决于断言结果。

## 断言引擎接口

`assert-engine.ts` 导出五个断言函数：

### 1. `assertPrompt` — 验证 Composer 输出包含/不包含指定字符串

```json
{
  "target": "composer-output-contains",
  "expect": {
    "contains": ["L0", "约会分身"],
    "notContains": ["As an AI"],
    "minLength": 800
  }
}
```

### 2. `assertState` — 验证状态快照中指定路径的值

```json
{
  "target": "affection-label-eq",
  "expect": {
    "source": "affectionState",
    "path": "relationship_label",
    "value": "acquaintance"
  }
}
```

### 3. `assertJsonPath` — 验证 JSON 路径上的值

```json
{
  "target": "topic-transition-type",
  "expect": {
    "json": "{...}",
    "path": "transition",
    "value": "return_to_main"
  }
}
```

### 4. `assertLabel` — 验证标签值

```json
{
  "target": "affection-label-eq",
  "expect": {
    "source": "affectionState",
    "path": "relationship_label",
    "label": "good_terms"
  }
}
```

### 5. `assertForbiddenSubstring` — 验证输出不包含禁用词

```json
{
  "target": "composer-output-not-contains",
  "expect": {
    "source": "composerOutput",
    "patterns": ["As an AI", "I cannot"]
  }
}
```

## 断言 severity

每条断言可以标记 `severity`：

- `"blocking"`（默认）: 失败时 case 判定为 fail，CI exit code 1
- `"warning"`: 失败时仅打印警告，不影响 verdict

## 如何解读失败输出

```
✗ EVAL-001: 验证 L0 安全层始终出现在组合 prompt 中
  ✗ Expected prompt to contain "L0 always overrides"
    expected: L0 always overrides
    actual:   not found in output (length=5420)
```

输出含义：
- **case id**: `EVAL-001`
- **断言名**: `Expected prompt to contain "L0 always overrides"`
- **expected**: 断言期望的值
- **actual**: 实际观测到的值

常见失败原因：
1. **`not found in output`**: Composer 没有生成预期的字符串 → 检查 `shared/safety.md` 是否损坏
2. **`label mismatch`**: 好感度标签与预期不符 → 查看 case 中给定的输入事件序列
3. **`path not found`**: 状态对象缺少预期的字段 → 检查机制 runner 是否正确填充了 `EvalState`

## LLM Case 的行为

- 当 case 的 `requiresLlm: true` 时，确定性层（`test:evals`）会**跳过**该 case（不加载，13 total / 0 skip）
- LLM 层（`test:evals:llm`）在有 `DEEPSEEK_API_KEY` 时执行全部 case（17 total）；无 key 时 `filterByTier()` 过滤掉 `requiresLlm` 的 case（13 total），而非执行后标记 SKIP
- **无 `DEEPSEEK_API_KEY` 时不会 fail**——`requiresLlm` case 在加载阶段即被过滤，runner 以 exit 0 退出

## 沙箱隔离

每个 eval case 获得独立的临时目录：

```
tmp/evals/EVAL-001-1719001234567/
├── users/
│   └── agent-a/
│       ├── style.md
│       └── social/by_agent/agent-b/
│           ├── objective_facts.jsonl
│           └── preferences.jsonl
```

- 通过设置 `ECHO_MEMORY_BASE_DIR` 环境变量，让所有服务写入沙箱路径
- Case 结束后 `destroy()` 清理整个临时目录
- 即使 case 异常退出，`finally` 块也会执行清理
