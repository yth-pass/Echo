# 记忆生命周期

| 字段 | 值 |
|------|-----|
| **相关** | [storage-schema.md](./storage-schema.md)、[affection-protocol.md](./affection-protocol.md) |

记忆如何写入、晋升、过滤、注入。

---

## 1. 风格 vs 记忆

| 关注点 | 存储 | 不在 |
|--------|------|------|
| 怎么说 | style.md | memory jsonl |
| 本人事实 | profile / semantic / episodic | style.md |
| 他人事实/观点 | social ①② | style.md |
| 当前话题 | current_topic.json | 长期 jsonl |

---

## 2. 写入规则

| 来源 | 默认 | 目标 |
|------|------|------|
| 用户明确陈述 | confirmed | core / semantic |
| 其他 Agent 明确陈述 | active | ① |
| 观点/抱怨 | active/candidate | ② |
| LLM 推断 | candidate | ② |
| Assistant 回复 | **不自动写入** | — |

---

## 3. ②→① Promote

1. 其他 Agent **明确准确**表述匹配 ② candidate  
2. 追加 ①；② 标 `promoted_to_objective`  
3. 矛盾 → ② `contradicted`，不写 ①  

见 [adr/003-promote-pipeline-2-to-1.md](./adr/003-promote-pipeline-2-to-1.md)。

---

## 4. 观察者相对

联合对话后 **A、B 各抽取各写** `social/by_agent/{other}/`。  
无单一「上帝视角」记忆文件。

---

## 5. share_policy

| 策略 | 行为 |
|------|------|
| `never` | 永不复述 |
| `do_not_repeat_to_subject` | 不对 subject 说 |
| `ok_if_relevant` | 相关时可谨慎提及 |

---

## 6. 抽取时机

| 事件 | 动作 |
|------|------|
| 每轮 | TopicJudge |
| `return_to_main` | SocialExtract + PromoteCheck |
| `new_main` | 对归档 bundle 抽取 |
| 会话结束 | summary + RelationshipExtract |

详细流程见英文 [memory-lifecycle.md](../agent-platform/memory-lifecycle.md)。
