# Prompt Layers

| Field | Value |
|-------|-------|
| **Related** | [architecture.md](./architecture.md), [Software Architecture §8.2](../Software-Architecture-Echo.md) |

How the Prompt Composer assembles the LLM request each turn.

---

## 1. Layer stack

```
┌─────────────────────────────────────────────────────────┐
│ L0  safety.md                     [always · highest]    │
├─────────────────────────────────────────────────────────┤
│ L1  shared-agent/SKILL.md         [always · capability] │
├─────────────────────────────────────────────────────────┤
│ L2  users/{id}/style.md           [always · voice]      │
├─────────────────────────────────────────────────────────┤
│ L3  profile.core.json             [always · who am I]    │
├─────────────────────────────────────────────────────────┤
│ L4  semantic facts (self)         [retrieved]           │
│ L5  episodic events (self)        [retrieved]           │
│ L6  social ①② (about other)       [retrieved]           │
├─────────────────────────────────────────────────────────┤
│ L7  session / joint summary       [when session exists] │
├─────────────────────────────────────────────────────────┤
│ L8  recent turns (last N)         [sliding window]      │
├─────────────────────────────────────────────────────────┤
│ +   current_topic (main + sub)    [every turn]          │
│ +   affection overlay             [when other present]  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Layer details

| Layer | Source | Max size (guideline) | Load |
|-------|--------|----------------------|------|
| L0 | `shared-agent/references/safety.md` | ~300 tokens | Always |
| L1 | `shared-agent/SKILL.md` (compact cache) | ~400 tokens | Always |
| L2 | `users/{id}/style.md` | ~400 tokens | Always |
| L3 | `profile.core.json` | ~200 tokens | Always |
| L4 | `semantic/facts.jsonl` | 0–500 tokens | top_k retrieve |
| L5 | `episodic/events.jsonl` | 0–400 tokens | top_k + time bias |
| L6 | `social/by_agent/{other}/` ①② | 0–400 tokens | when other in participants |
| L7 | `summary.md` | ~300 tokens | current session |
| L8 | `turns.jsonl` tail | 6–10 turns | sliding window |
| Topic | `current_topic.json` | ~200 tokens | always |
| Overlay | `affection.json` → label | ~100 tokens | when chatting with other |

---

## 3. Merge priority (conflict resolution)

| Priority | Layer | Wins over |
|----------|-------|-----------|
| 1 | L0 Safety | Everything |
| 1 | share_policy / visibility | L6 content injection |
| 2 | L1 Capability | L2 style when safety-related |
| 3 | L2 Style | L8 history tone |
| 4 | L3–L6 Facts | Must not invent beyond retrieved + core |
| 5 | L8 History | Lowest for tone; facts from L3–L6 |

**Rule:** Style (L2) must never override factual accuracy or safety (L0, L1).

---

## 4. Mapping to Software Architecture §8.2

| Architecture §8.2 layer | Agent platform layers |
|-------------------------|------------------------|
| **System** — platform rules, safety | L0 + L1 |
| **Persona** — user tone | L2 (`style.md`) |
| **Context** — session type, opponent | L7 + Topic + Overlay + participants |
| **Memory** — short/long term | L3–L6 + L8 |

Phase 1 today: single system string + `persona_prompts.prompt_text`. Target: full Composer per this table.

---

## 5. Example injected blocks

### Topic block

```markdown
## Current conversation
### Main topic (ongoing)
- Label: Weekend homework progress
- Summary: Asking how much math and English is done.

### Active focus: subtopic (return to main when done)
- Label: Complaints about homeroom teacher workload
- Summary: Peer says too much homework assigned.
```

### Social memory block (L6)

```markdown
## About counterparty (u002) — observer view
### Confirmed facts ①
- [explicit] Working on an AI chat product (said in joint_88)

### Preferences / inferences ②
- [opinion] Dislikes long meetings
- [inferred|0.55] May feel anxious about deadlines — do not state as fact
```

### Relationship overlay

```markdown
## Relationship with u002
- Label: friendly_acquaintance
- Trust: moderate — cite explicit facts; hedge on ② inferred items
- Do not disclose observer_private items to u002
```

---

## 6. Optional Pass2 style rewrite

For high-fidelity replies (V4):

1. **Pass1:** Generate accurate content (L0–L8 without strict style enforcement).
2. **Pass2:** Rewrite tone using L2 only; must not change facts.

Not required for MVP.

---

## 7. Composer pseudocode

```
function composePrompt(userId, message, sessionId, participants):
  system = load(L0) + load(L1) + load(L2 for userId) + load(L3 for userId)
  if participants contains otherId:
    system += retrieve(L6, userId, otherId, message)
    system += formatAffectionOverlay(userId, otherId)
  system += retrieve(L4, L5, userId, message)
  system += formatTopic(load(current_topic for sessionId))
  system += load(L7 for sessionId)
  messages = load(L8 for sessionId) + [{ role: user, content: message }]
  return { system, messages }
```

Implementation target: `services/worker/src/agent-platform/composer/`.
