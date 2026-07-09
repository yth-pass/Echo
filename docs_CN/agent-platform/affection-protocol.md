# 好感度协议

| 字段 | 值 |
|------|-----|
| **相关** | [storage-schema.md](../agent-platform/storage-schema.md), [schemas/affection.schema.json](./schemas/affection.schema.json), [memory-lifecycle.md](../agent-platform/memory-lifecycle.md) |

观察者 Agent 对另一 Agent 的关系分。**A→B 与 B→A 独立。**

---

## 1. 用途

建模 clone A **对** clone B 的感受，用于：

- 对 B 说话的语气（关系 overlay）
- 引用 B 的 ①② 记忆时的信任校准
- 不与 Phase 1 匹配列表兼容度 %（`affinity_scores.score`）混用

---

## 2. 四维（0–100）

| 维度 | 含义 |
|------|------|
| familiarity | 熟悉度 |
| warmth | 亲近度 |
| trust | 信任度 |
| tension | 张力/冲突 |
| tension_quality | `situational`（短期摩擦）或 `structural`（深层不信任）；默认 `situational` |

**`tension_quality`（R1）：** 区分 tension 的*衰减方式*，而非 tension 数值本身。`situational` 标记常规冲突（`conflict`），可随时间消散；`structural` 标记深层伤害（`insult_or_rude`、`trust_break`），在修复前阻止自动衰减。在 apply 时若事件产生正向 tension delta 则设置；`structural` 在 apply 中不会降级为 `situational`（仅当 `structural` 且 tension 已为 0 时，decay 将 quality 重置为 `situational`）。

**综合分（默认权重）：**

```
composite_affinity =
  0.25 * familiarity
+ 0.35 * warmth
+ 0.30 * trust
- 0.40 * tension
```

各维度与 composite 均钳制在 0–100。

---

## 3. relationship_label 映射

`computeLabel` 按**严格优先级**判定（首个满足即返回）：

| 优先级 | 标签 | 条件 |
|--------|------|------|
| 1 | `strained` | tension ≥ 50，或（warmth < 25 且 familiarity ≥ 15） |
| 2 | `distant` | trust ≤ 40 且 tension ≥ 40 且 familiarity < 20 |
| 3 | `friendly_but_cautious` | trust ≥ 25 且 warmth ≥ 40 且 tension ≥ 25 |
| 4 | `close` | composite ≥ 75 且 trust ≥ 70 且 tension < 20 |
| 5 | `good_terms` | composite ≥ 60 且 tension < 30 |
| 6 | `friendly_acquaintance` | composite ≥ 40 |
| 7 | `stranger` | familiarity < 15 |
| 8 | `acquaintance` | 默认兜底 |

`computeLabel` 之后，`applyHysteresis` 可在 composite 接近阈值时保持原标签（见 §6b）。B 层事件门控与 C 层 LLM 裁决可进一步拦截标签变更。

向 prompt 注入**标签 + 行为提示**，非裸数字（管理端 UI 可选显示数值）。

---

## 4. 事件驱动更新

**不要**让 LLM 每轮直接输出「+5 warmth」。

LLM **RelationshipExtract** 抽取 event → **AffectionApply** 规则改分。

---

## 5. event_type 与默认 delta

| event_type | 默认 delta | 备注 |
|------------|------------|------|
| `positive_engagement` | familiarity +2, warmth +2 | 长对话 |
| `compliment` | warmth +3, familiarity +1 | |
| `helpful_share` | warmth +2, trust +2 | |
| `agreement` | warmth +2 | |
| `conflict` | tension +5, warmth -3 | 话题 valence=negative |
| `insult_or_rude` | tension +10, warmth -8 | |
| `apology_or_repair` | tension -6, warmth +3 | |
| `trust_confirm` | trust +4 | ②→① promote |
| `trust_break` | trust -8, tension +3 | ② 被 contradicted |
| `deep_share` | trust +3, warmth +2 | 敏感深度分享 |
| `collaborative_success` | trust +3, familiarity +1 | 协作成功 |
| `support_received` | trust +4, warmth +2 | 对方帮助观察者 |
| `support_given` | trust +3, warmth +1 | 观察者帮助对方 |
| `explicit_bond` | warmth +5（有 cap） | 明确表态「我们是好朋友」 |
| `session_contact` | familiarity +1 | 每次联合 session |
| `value_alignment` | warmth +4, trust +3 | 价值观契合 |
| `preference_match` | warmth +3, trust +2 | 偏好一致 |

**tension_quality 规则**（apply 时 tension delta > 0 生效；`structural` > `situational`，不可降级）：

| event_type | tension_quality |
|------------|-----------------|
| `conflict` | `situational` |
| `insult_or_rude` | `structural` |
| `trust_break` | `structural` |
| （其他） | `situational` |

`apology_or_repair` 降低 tension 但不清除 `structural`；仅当 decay 时 `tension_quality === 'structural'` 且 tension 为 0 时重置为 `situational`。

**上限：** 每 topic warmth 累计 |delta| ≤ 8；每 session composite |delta| ≤ 15。

---

## 6. 衰减（后台 job）

`runAffectionDecay` 根据距 `last_interaction_at` 的无接触天数施加衰减（对同一间隔幂等）。

| 维度 | 触发（无接触） | 速率 | 下限 |
|------|----------------|------|------|
| familiarity | ≥ 7 天 | -1/周 | 曾接触则 10，否则 0 |
| warmth | ≥ 14 天 | -1/周（trust ≥ 70 时 -0.5/周） | 0 |
| trust | ≥ 30 天 | -2/周（`repair_arc.trust_break_count` > 3 时 ×1.5） | 历史峰值 trust ≥ 30 则 10，否则 0 |
| tension | ≥ 14 天 | -2/周 | 0 |

**tension 例外：** `dimensions.tension_quality === 'structural'` 时 tension 不自动衰减（深层不信任持续）。`situational` 时按 -2/周从 14 天无接触起衰减。decay 时若 `structural` 且 tension 已为 0（如被道歉清除），quality 重置为 `situational`。

### 6b. 标签迟滞

`applyHysteresis` 减少正向阶梯（`stranger` → `close`）上的标签来回跳变：

- **升级迟滞：** composite 须达到目标标签阈值的 **110%**（例：friendly_acquaintance → good_terms 需 composite ≥ 66）。
- **降级抵抗：** composite 须跌破原标签阈值的 **90%**（例：close → good_terms 需 composite ≤ 67.5）。

**豁免：** tension ≥ 50 的 `strained`；`stranger` → `acquaintance` 初次升级。

### 6c. 信任修复弧

存于 `AffectionState.repair_arc`（不在 `dimensions` 内）：

| 字段 | 含义 |
|------|------|
| `trust_break_count` | 累计 `trust_break` 次数 |
| `positive_interactions_since_break` | 上次破裂后正面信任互动次数 |
| `is_in_repair_arc` | 是否处于修复弧（信任增益打折） |

`trust_break` 后，正面信任事件（`trust_confirm`、`deep_share`、`collaborative_success`、`support_received`、`support_given`）仅对 **trust 正向增益** 乘以：

| 破裂后互动次数 | 增益系数 |
|----------------|----------|
| 1–3 | × 0.50 |
| 4–6 | × 0.75 |
| 7+ | × 1.00（修复弧结束） |

`trust_break` 负向 delta 不打折。trust 不会自动回到破裂前水平；修复弧中再次 `trust_break` 会将互动计数归零。

**Overlay 修复弧透明度（R3）：** 当 `is_in_repair_arc === true` 时，`AffectionOverlayService.render` 增强关系 overlay：

- **Tone：** 追加 `REPAIR ARC (progress/7): trust is fragile.` 及阶段提示 — Early rebuilding（剩余 > 4）、Mid-recovery（剩余 3–4）、Nearly rebuilt（剩余 ≤ 2）。
- **Repair Arc 行：** `- Repair Arc: {progress}/7 positive interactions toward trust recovery`（仅修复弧激活时显示）。
- **Trust：** 追加 `(REPAIR ARC — gains dampened, must earn back trust gradually)`。

修复弧结束（`is_in_repair_arc === false`）后，overlay 恢复为仅标签提示，无修复行。

---

## 7. 与记忆的信任联动

| 记忆事件 | 好感度 event |
|----------|--------------|
| ②→① promote | `trust_confirm` |
| ② contradicted | `trust_break` |

---

## 8. 关系 overlay（Composer）

```markdown
## Relationship with {other_agent_id}
- Label: friendly_acquaintance
- Tone: Warm but light — friendly tone, avoid deep personal leaps
- Trust: moderate — confirm before stating ② inferred items as facts
- Tension: low — tone may be relaxed
- Never disclose items with share_policy do_not_repeat_to_subject
```

8 种标签均在 `AffectionOverlayService` 有专属 **Tone** 提示（例：`friendly_but_cautious` — 表面友好、信任谨慎）。数值判定规则 3：trust ≥ 25、warmth ≥ 40、tension ≥ 25。当 `repair_arc.is_in_repair_arc` 时，见 §6c overlay 透明度（R3）。

---

## 9. Phase 1 说明

现状：`affinity_scores.score` 单值。目标：持久化 `affection.json` + events。见 [echo-mapping.md](../agent-platform/echo-mapping.md)。

---

## 12. 8 种标签完整转化表（M6）

所有 8 个 `RelationshipLabel` 值现在都有明确的数值 + 事件驱动的转化规则（双向）。

**升级路径（正向标签）：**

| From → To | 所需维度（基础） | 必须事件 | 最小正向事件数 | 最小不同话题数 | 备注 |
|-----------|------------------|----------|----------------|----------------|------|
| any → acquaintance | familiarity ≥15, warmth≥25, trust≥20, tension≤50 | — | — | — | 基础数值门 |
| acquaintance → friendly_acquaintance | familiarity≥20, warmth≥40, trust≥35, tension≤35 | — | 1 | — | 单个正向事件即可 |
| friendly_acquaintance → good_terms | familiarity≥40, warmth≥55, trust≥50, tension≤30 | `explicit_bond` | 4 | — | 需要 `explicit_bond`；关键事件触发松弛 |
| good_terms → close | familiarity≥60, warmth≥70, trust≥70, tension≤20 | `explicit_bond` + `value_alignment` | 6 | 2 | 最严格门；多话题 + 双关键事件 |

**降级路径（负向/谨慎标签）：**

| From → To | 所需维度（负面） | 必须事件 | 最小负向事件数 | 备注 |
|-----------|------------------|----------|----------------|------|
| any → strained | trust ≤30, tension ≥60 | `conflict` / `insult_or_rude` / `trust_break` | 2 | 严重破裂 |
| any → distant | trust ≤40, tension ≥40 | `conflict` | 1 | 反复摩擦 |
| any → friendly_but_cautious | trust ≤25, tension ≥45, warmth ≤20 | `trust_break` | 1 | 混合信号（正向互动后出现破裂） |

**在 `checkLabelUpgrade` / `checkLabelDowngrade` 中应用的规则：**

- 若目标标签无规则定义 → 允许（极端 tension 情况回退到 computeLabel）
- 仅对升级至 `good_terms`/`close`/`friendly_acquaintance` 时应用动态松弛；当存在关键事件（`explicit_bond`、`value_alignment`）时，根据强度（weak/moderate/strong）和每事件加成调整松弛量
- LLM judge（C）仅在高价值升级通过数值+事件门后仍执行
- 降级不使用松弛；负向事件直接强制阈值

至此完成 Phase 1 演示的 8 标签转化模型。

---

## 13. Reciprocity 弱耦合（R2）

可选的单向信号：观察者 A 对 B 的 warmth **增量** 可能随 B 近期对 A 的 warmth 变化而缩放。**A→B 与 B→A 的数值维度仍完全独立**；仅在 apply 时调节 warmth 增量。

| 配置（`ReciprocityConfig`） | 默认 | 含义 |
|-----------------------------|------|------|
| `enabled` | `false` | 总开关（向后兼容） |
| `maxMultiplier` | `1.20` | 对方升温时的最大增益系数 |
| `minMultiplier` | `0.80` | 对方冷淡时的打折系数 |
| `warmthDropThreshold` | `15` | 对方窗口内 warmth 下降须超过此值才触发冷淡调节 |

**启用时（联合 session / 可读对方最新状态）：**

- 读取 `otherId → observerId` 好感状态；要求 `last_interaction_at` 在 **7 天**内。
- 计算对方 **7 天窗口内 warmth 增量**（窗口内事件 warmth delta 之和）。
- 对方升温（`otherWarmthDelta > 0`）且本方 warmth 增量 > 0 → 最高 × `maxMultiplier`（增益上限 +20%）。
- 对方冷淡（`otherWarmthDelta < -warmthDropThreshold`）且本方 warmth 增量 > 0 → × `minMultiplier`。
- 对方冷淡且本方 warmth 增量 < 0 → 负向增量 × `maxMultiplier`（摩擦放大）。

实现于 `reciprocity.service.ts`（`computeReciprocityMultiplier`）与 `AffectionApplyService.apply`（事件聚合后、topic warmth cap 前）。不直接影响 trust、tension、familiarity 或 composite。
