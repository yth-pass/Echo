# M7 LLM Judge 策略文档

## 概述

LLM judge 是 M7 Evals 的语义层断言引擎。它调用 DeepSeek API（temperature=0）对 Agent 输出进行语义评估，覆盖规则无法检测的质量维度。

## 何时用规则 vs 何时用 LLM Judge

| 场景 | 规则 | LLM Judge | 理由 |
|------|------|-----------|------|
| 格式检查（中文/纯文本/无 markdown） | ✓ 主 | 辅助 | 规则快、确定、无 flake |
| 长度/Token 预算 | ✓ 主 | - | 纯算术 |
| 隐私泄露（含特定关键词） | ✓ 主 | ✓ 辅助 | 关键词=规则；同义替换=LLM |
| 风格一致性（tone/persona） | - | ✓ 主 | 语义判断，规则无法覆盖 |
| 道听途说判断（推断 vs 事实） | ✓ 结构 | ✓ 主 | 结构=规则；语义=LLM |
| 话题回归质量 | ✓ 结构 | ✓ 主 | transition 类型=规则；回归自然度=LLM |

**原则**：规则先行，LLM兜底。规则断言总是先执行（确定性层 + LLM层都跑），LLM judge 只在 LLM 层执行。

## 避免 Flake 的策略

### 1. Temperature = 0

所有 LLM judge 调用使用 `temperature: 0`。DeepSeek 的 temperature=0 输出高度确定，减少随机波动。

### 2. 重试上限 = 3

LLM judge 内部有 3 次重试机制：

```
Attempt 1: 调用 LLM → 解析 PASS/FAIL
  ├─ 首词 "PASS" → 返回 pass=true
  ├─ 首词 "FAIL" → 返回 pass=false
  └─ 其他 → retry (attempt 2)
Attempt 2: 同上
Attempt 3: 同上 → 仍不明确 → 返回 pass=false, flaky=true
```

### 3. Flaky 标记

如果多次重试得到不同结果（例如 attempt 1 = PASS, attempt 2 = FAIL），标记 `flaky: true`。Case 仍按最终结果判定，但 CI 报告会突出显示。

### 4. Flake 率目标与监控

- **目标**：同一 case 连跑 3 次 ≥2 次 pass
- **标记**：连续 3 次跑出不同结果 → 给 case 加 `flaky` tag
- **处理**：flaky case 在 CI 中 severity 降为 `warning`，不阻塞合并

## LLM Judge 四种类型

### 1. Style Judge (`judgeStyle`)

检查生成的回复是否符合 persona 和 L8 契约：

- 语言：简体中文（专有名词除外）
- 格式：纯文本，无 markdown/JSON/code block
- 语调：匹配 persona 描述
- 安全：不适当的用户消息应礼貌拒绝

### 2. Memory Leak Judge (`judgeMemoryLeak`)

检查回复是否泄漏了受 `share_policy` 保护的信息：

- 输入：敏感事实列表 + Agent 回复
- 判断：回复中是否出现（或改写）敏感事实
- 标准：即使同义替换也算泄漏

### 3. Hearsay Judge (`judgeHearsay`)

检查回复是否将未确认的推断当作既定事实：

- 输入：未确认推断列表 + Agent 回复
- 判断：回复是否以 "我知道..."、"你是..." 等方式陈述推断
- 标准：使用 "听说..."、"可能..." 等限制词是可以接受的

### 4. Topic Return Judge (`judgeTopicReturn`)

检查回复是否正确地从 subtopic 回到 main topic：

- 输入：main topic + subtopic + Agent 回复
- 判断：回复是否承认并转回 main topic
- 标准：停留在 subtopic 或引入新话题 = FAIL

## LLM Judge Prompt 设计原则

1. **明确二选一**：Judge 必须输出 PASS 或 FAIL，不允许 "可能"、"不确定"
2. **结构化输出**：首行 PASS/FAIL，第二行简短理由（≤100字）
3. **具体标准**：每个 judge 有明确的通过/失败标准列表
4. **无偏见**：不预设答案，仅基于给定标准判断

## 与现有 e2e-m6-closeout.ts 的关系

`e2e-m6-closeout.ts` 是 M6 收口用的全链路 E2E 测试（4 个 scenario），覆盖 affection 管线。

**M7 之后的定位**：

| 文件 | 定位 | 何时用 |
|------|------|--------|
| `e2e-m6-closeout.ts` | **保留**：M6 affection 收口验证 | 开发 affection 变更时手动运行 |
| `npm run test:evals` | **权威**：确定性回归 | 每 PR CI |
| `npm run test:evals:llm` | **权威**：语义回归 | main 合并 / 夜间 |

**不 deprecated**：`e2e-m6-closeout.ts` 保留作为开发者工具，但 M7 eval suite 是 CI canonical。两者测试范围不重叠（e2e-m6 测 affection 全链路 + decay + reciprocity；M7 LLM eval 测四类语义回归）。

**npm scripts 对照**：

```json
{
  "test:e2e:m6": "ts-node .../e2e-m6-closeout.ts",    // 保留，手动运行
  "test:evals": "ts-node ...run-evals.ts --tier deterministic",  // CI canonical
  "test:evals:llm": "ts-node ...run-evals.ts --tier llm"         // CI canonical (LLM)
}
```

## 实现注意事项

1. **API Key 缺失时 skip 而非 fail**：LLM judge 在无 `DEEPSEEK_API_KEY` 时返回 `pass: true`（skip），不影响 exit code
2. **单次调用超时 30s**：LLM judge 设置 30s 超时，避免 CI 挂起
3. **不缓存结果**：每次 CI 运行都是新鲜调用，保证回归检测有效性
4. **报告可追溯**：每个 LLM judge 结果记录在 JSON report 中，含完整 reason
