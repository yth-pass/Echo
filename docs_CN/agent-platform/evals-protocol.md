# M7 Evals 协议 — 维护与操作指南

| 字段 | 值 |
|------|-----|
| **状态** | 活跃 |
| **关联** | [M7-Evals-Architecture.md](./M7-Evals-Architecture.md), [M7-LLM-Judge-Strategy.md](./M7-LLM-Judge-Strategy.md), [implementation-milestones.md](./implementation-milestones.md) |
| **最后更新** | 2026-06-21 |

---

## 1. Eval Suite 总览

### 两档

| 档位 | 脚本 | 触发 | 依赖 | 阻止合并 |
|------|------|------|------|----------|
| 确定性 | `npm run test:evals` | 每个 PR | 无（纯 TS） | **是** |
| LLM | `npm run test:evals:llm` | main/夜间 | `DEEPSEEK_API_KEY` | 否（建议性） |

### Case 清单

| 类别 | 确定性 | LLM | 负向探针 | 合计 |
|------|--------|-----|----------|------|
| style | 4 | 1 | 1 | 6 |
| memory-leak | 3 | 1 | 1 | 5 |
| hearsay | 3 | 1 | 1 | 5 |
| topic-return | 2 | 1 | 1 | 4 |
| 其他 | 1 | 0 | 1 | 2 |
| **合计** | **13** | **4** | **5** | **22** |

---

## 2. 如何新增 Eval Case

### 确定性 case

1. 选择下一个 EVAL-XXX 编号
2. 选择 mechanism: `composer` / `topic` / `memory` / `affection`
3. 选择 tags: `style` / `memory-leak` / `hearsay` / `topic-return`
4. 创建 `cases/deterministic/EVAL-XXX-<描述>.json`
5. 设置 `"requiresLlm": false`
6. 使用 `"assertType": "rule"` 断言
7. 运行 `npm run test:evals` → 应 PASS

### LLM case

同上，外加：
1. 设置 `"requiresLlm": true`
2. 使用 `"assertType": "llm-judge"`，`"llmPrompt"` 设为 `"style"` / `"memory-leak"` / `"hearsay"` / `"topic-return"`
3. 运行 `npm run test:evals:llm`

---

## 3. Golden Fixture 维护

### 何时修改 golden

平台代码有意变更时：
1. 更新 case 以反映新的预期行为
2. 运行 suite 验证通过
3. **绝不要为了通过回归而修改 case** — case 应编码不变量

### 负向探针管理

```bash
# 启用
cp cases/llm/_EVAL-025-hearsay-negative.json.disabled cases/llm/EVAL-025.json
npm run test:evals:llm  # 预期: FAIL, exit 1

# 禁用
rm cases/llm/EVAL-025.json
```

---

## 4. Flake 处理

### 确定性层

确定性 case 使用纯规则断言 — **零 flake 风险**。如果出现 flake：
1. 断言检查了非确定性内容 → 移至 LLM 层
2. 环境状态不一致 → 修复沙箱初始化
3. 服务有竞态条件 → 修复服务本身

### LLM 层

LLM case 天然存在非确定性。缓解措施：

| 层级 | 策略 |
|------|------|
| LLM Judge | `temperature=0`，3 次重试，结构化 PASS/FAIL 输出 |
| 平台服务 | `temperature=0.1`（TopicJudge, SocialExtract） |
| Case 设计 | 断言不变量，非创意输出 |

**Flake 率目标**: 同一 case × 3 次 ≥ 2 次 PASS。

**标记 flaky case**：
1. 标记 `"severity": "warning"`
2. 添加 `flaky` tag
3. 在 description 中注明原因

### 配额失败 vs 代码回归

LLM API 因配额/限速返回错误时：
- 非阻塞（`continue-on-error`）
- Job summary 区分: "API Key missing" vs "Evaluation Failed"
- 查看 artifact 报告确认是否真回归

---

## 5. CI 流水线

```
PR / main push
  ├─ job: eval-deterministic
  │   ├─ lint (tsc --noEmit)
  │   ├─ test:affection
  │   └─ test:evals ← 阻塞
  │
  └─ (main push / 夜间)
      └─ job: eval-llm
          ├─ 检查 DEEPSEEK_API_KEY
          ├─ test:evals:llm ← 建议（不阻塞）
          └─ 上传 artifact 报告
```

### Artifacts

| Job | 何时 | Artifact | 保留 |
|-----|------|----------|------|
| eval-deterministic | 失败时 | `eval-report-deterministic` | 7 天 |
| eval-deterministic | 成功时 | `eval-report-deterministic-pass` | 1 天 |
| eval-llm | 始终 | `eval-report-llm` | 14 天 |

### 回滚：临时跳过 LLM job

**方案 A（推荐）**: 从 repo settings 中移除 `DEEPSEEK_API_KEY` → LLM job 自动 skip。

**方案 B**: 编辑 workflow:
```yaml
eval-llm:
  if: false  # <-- 添加此行禁用
```

---

## 6. 退出验收清单

### 合并前验证

- [x] `npm run test:evals` 在干净分支 exit 0
- [x] `npm run test:evals:llm` 在干净分支 exit 0（有 API key）
- [x] `npm run test:evals:llm` 无 API key 时 exit 0（优雅跳过 LLM case）
- [x] 启用 `_EVAL-REGRESSION-PROBE.json.disabled` → exit 1
- [x] `tsc --noEmit` 零新增错误

### CI 验证 — 确定性

- [x] `.github/workflows/agent-platform-evals.yml` 存在且被 PR 触发（workflow 文件已创建，`pull_request:` 事件已配置）
- [x] Job `eval-deterministic` 运行 `lint` + `test:affection` + `test:evals`（workflow YAML 中步骤已验证）
- [x] 确定性 job 不需要任何 secrets（eval-deterministic job 中无 `secrets.*` 引用）
- [x] 失败的确定性 eval 阻止 PR 合并（exit code 1 → job 失败 → PR check 红色；本地验证通过）
- [x] 失败时上传 artifact 报告（workflow YAML 中 `upload-artifact@v4` + `if: failure()`）

### CI 验证 — LLM

- [x] Job `eval-llm` 在 main push 和夜间调度时运行（workflow YAML 中 `push:` + `schedule:` 触发条件）
- [x] 使用 `DEEPSEEK_API_KEY` secret（env 中 `${{ secrets.DEEPSEEK_API_KEY }}`）
- [x] 缺失 API key 时 skip 而非 fail，exit 0（本地验证：`DEEPSEEK_API_KEY="" npm run test:evals:llm` → 13 PASS, exit 0）
- [x] LLM eval 失败 → 仅建议告警（不阻塞合并）（workflow YAML 中 `continue-on-error: true`）
- [x] Job summary 区分"无 key"与"eval 失败"（workflow YAML 中 `outcome` step + `GITHUB_STEP_SUMMARY`）

### 回归探针

- [x] 故意破坏 Composer（删除 L0 文本）→ `eval-deterministic` FAIL（通过 `_EVAL-REGRESSION-PROBE` 验证）
- [x] 故意破坏 affection 规则（改变标签转换）→ `eval-deterministic` FAIL（通过 `_dummy-fail.json.disabled` 验证）
- [x] 故意改变 persona 违反风格 → `eval-llm` FAIL（通过 `_EVAL-021-style-negative.json.disabled` 验证）
- [x] 还原修改 → 两个 job 都 PASS（去除 disabled 文件后恢复 17/17）

### 文档

- [x] `docs/agent-platform/evals-protocol.md` 存在
- [x] `docs_CN/agent-platform/evals-protocol.md` 存在
- [x] `README.md` 准确
- [x] 架构文档准确
- [x] `docs/agent-platform/M7-LLM-Judge-Strategy.md` 准确

---

## 7. 故障排查

| 症状 | 可能原因 | 解决方案 |
|------|----------|----------|
| `test:evals` CI 失败但本地通过 | OS 路径分隔符差异 | 使用 `path.join` |
| `test:evals:llm` 全部 SKIP | 未设置 secret | Settings → Secrets → Actions 添加 `DEEPSEEK_API_KEY` |
| LLM case 偶发 FAIL | API 配额/限速 | 查看 artifact；重新运行；标记 `flaky` |
| 所有 topic case 失败 | API 返回格式异常 | 检查 `topic-judge.service.ts` 回退逻辑 |
| 沙箱清理失败 | CI runner 磁盘满 | 重新运行 CI；临时目录跨 run 自动清除 |
