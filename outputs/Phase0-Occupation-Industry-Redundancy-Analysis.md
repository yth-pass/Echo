# Phase 0 职业与行业字段冗余分析

**分析日期**: 2026-07-04
**分析人**: UX Researcher (探真真)

## 核心结论

Phase 0 的 `occupation`（职业）和 `industry`（行业）两个必填字段存在严重冗余，建议合并为一个字段。

## 问题一：选项重叠率 80%

`occupation` 有 10 个选项，`industry` 有 12 个选项。其中 8 对高度重合：

| occupation | industry | 重合度 |
|---|---|---|
| 互联网/科技 | 互联网/科技 | 完全相同 |
| 金融 | 金融/投资 | 高度相似 |
| 教育 | 教育/学术 | 高度相似 |
| 医疗/健康 | 医疗/健康 | 完全相同 |
| 媒体/传播 | 媒体/内容 | 高度相似 |
| 制造业/工程 | 制造/工程 | 高度相似 |
| 学生 | 学生 | 完全相同 |
| 其他 | 其他 | 完全相同 |

**occupation 独有**（2 个）：设计/创意、法律/咨询
**industry 独有**（4 个）：公务员/事业单位、创业、自由职业、文化/艺术

## 问题二：选项字面不一致，制造认知摩擦

重合的选项字面表述不完全一致（如"金融" vs "金融/投资"），用户在连续两题中面对近似但不完全相同的选项，会产生"该选哪个"的困惑。

## 问题三：industry 字段在后端未被消费

### 关键发现

- `occupation`：在 `buildTextForEmbedding()` 和 `buildPersonaSeedFromSurvey()` 中被直接使用，影响 AI 分身人格生成和匹配嵌入向量
- `industry`：在上述两个核心函数中**完全未被引用**，仅存储在 `survey.identity` 结构中
- Phase 0 完成校验（`onboarding.service.ts` 第 698 行）只检查 `id.occupation`，未校验 `id.industry`

### 唯一例外

`industry` 选"创业"时触发 `entrepreneurshipField` 子字段，这是该字段唯一产生差异化信息的场景。

## 建议方案：合并为单一字段

### 合并选项列表（14 项，去重后）

```
互联网/科技 · 金融/投资 · 教育/学术 · 医疗/健康 · 设计/创意 ·
媒体/内容 · 法律/咨询 · 制造/工程 · 公务员/事业单位 · 创业 ·
自由职业 · 文化/艺术 · 学生 · 其他
```

### 改动范围

| 层 | 文件 | 改动 |
|---|---|---|
| 前端 | `phase0-fields.data.ts` | 删除 `industry` 字段定义，合并选项到 `OCCUPATION_OPTIONS` |
| 前端 | `onboarding-v2.types.ts` | `Phase0Payload` 删除 `industry` 字段 |
| 前端 | `Phase0Identity.tsx` | 条件显示逻辑从 `industry=创业` 改为 `occupation=创业` |
| 后端 | `onboarding.dto.ts` | `Phase0IdentityDto` 删除 `industry` 字段 |
| 后端 | `survey-schema.ts` | `identity` 子对象删除 `industry` |
| 后端 | `onboarding.service.ts` | 无需改（本来就没校验 industry） |
| Android | 暂不涉及 | Android 尚未升级到 v2.2 Phase 0 |

### 对下游影响

- **嵌入向量**：零影响（`buildTextForEmbedding` 本来只用 `occupation`）
- **人格生成**：零影响（`buildPersonaSeedFromSurvey` 本来只用 `occupation`）
- **匹配算法**：`matchPreferredOccupation` 复用 `OCCUPATION_OPTIONS`，合并后选项更完整，匹配信号更准确
- **创业子字段**：条件触发从 `industry=创业` 迁移到 `occupation=创业`，逻辑不变
