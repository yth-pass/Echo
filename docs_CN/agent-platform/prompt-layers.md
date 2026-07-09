# Prompt 分层

| 字段 | 值 |
|------|-----|
| **相关** | [architecture.md](./architecture.md)、[软件架构 §8.2](../Software-Architecture-Echo.md) |

Prompt Composer 每轮如何组装 LLM 请求。

---

## 1. 层栈

| 层 | 内容 | 加载 |
|----|------|------|
| L0 | safety.md | 始终 |
| L1 | shared-agent/SKILL.md | 始终 |
| L2 | users/{id}/style.md | 始终 |
| L3 | profile.core.json | 始终 |
| L4 | semantic（本人） | 检索 |
| L5 | episodic（本人） | 检索 |
| L6 | social ①② | 有 other 时检索 |
| L7 | session summary | 有会话 |
| L8 | 最近 N 轮 | 滑动窗口 |
| + | current_topic | 每轮 |
| + | affection overlay | 对 other 对话 |

---

## 2. 与架构 §8.2 映射

| 架构 §8.2 | Agent 平台层 |
|-----------|--------------|
| System | L0 + L1 |
| Persona | L2（style.md） |
| Context | L7 + Topic + Overlay |
| Memory | L3–L6 + L8 |

Phase 1 现状：单一 system + `persona_prompts.prompt_text`。

---

## 3. 合并优先级

1. L0 安全 — 最高
2. share_policy / visibility
3. L1 能力
4. L2 风格（不覆盖安全）
5. L3–L6 事实
6. L8 历史（语气以 L2 为准）

---

## 4. Composer 伪代码

```
system = L0 + L1 + L2 + L3
if other in participants: system += retrieve(L6) + affectionOverlay
system += retrieve(L4,L5) + formatTopic + L7
messages = L8 + new user message
```

实现目标：`services/worker/src/agent-platform/composer/`。

详细示例见英文 [prompt-layers.md](../agent-platform/prompt-layers.md)。
