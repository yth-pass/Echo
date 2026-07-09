# Echo Agent Platform — Target Design

| Field | Value |
|-------|-------|
| **Document Version** | 1.0.0 |
| **Status** | Active (Target Design) |
| **Related (as-built)** | [Agent Behavior & Mechanics](../Agent-Behavior-and-Mechanics-Echo.md) |
| **Related (architecture)** | [Software Architecture §8.2](../Software-Architecture-Echo.md) |

This directory defines the **target design** for Echo's multi-user Agent platform: shared skill base, per-user style, layered memory, main/sub topics, social memory (①②), affection, and Prompt Composer runtime.

**This is not Phase 1 as-built documentation.** For current implementation status, read [Agent-Behavior-and-Mechanics-Echo.md](../Agent-Behavior-and-Mechanics-Echo.md) and [echo-mapping.md](./echo-mapping.md).

---

## Document index

| File | Description |
|------|-------------|
| [architecture.md](./architecture.md) | Three domains, runtime Composer flow |
| [mechanisms.md](./mechanisms.md) | 22 mechanisms — goals, implementation, storage |
| [storage-schema.md](./storage-schema.md) | Directory tree and JSON/JSONL field specs |
| [prompt-layers.md](./prompt-layers.md) | L0–L8 layers and relationship overlay |
| [topic-state-machine.md](./topic-state-machine.md) | Main/sub topics, 5 transitions, TopicJudge |
| [memory-lifecycle.md](./memory-lifecycle.md) | Extraction, ②→① promote, privacy |
| [affection-protocol.md](./affection-protocol.md) | Four dimensions, events, deltas |
| [api-contracts.md](./api-contracts.md) | Target API sketch mapped to `services/api` |
| [echo-mapping.md](./echo-mapping.md) | Target vs Phase 1 gap analysis |
| [implementation-milestones.md](./implementation-milestones.md) | M0–M8 delivery plan |
| [schemas/](./schemas/) | JSON Schema for LLM outputs and storage |
| [adr/](./adr/) | Architecture Decision Records |

---

## Reading order

| Goal | Start here |
|------|------------|
| Understand overall shape | [architecture.md](./architecture.md) |
| See all mechanisms at a glance | [mechanisms.md](./mechanisms.md) |
| Implement storage / DB | [storage-schema.md](./storage-schema.md) + [schemas/](./schemas/) |
| Implement chat / Composer | [prompt-layers.md](./prompt-layers.md) + [topic-state-machine.md](./topic-state-machine.md) |
| Map to existing Echo code | [echo-mapping.md](./echo-mapping.md) |
| Plan sprints | [implementation-milestones.md](./implementation-milestones.md) |

---

## Target vs Phase 1

| Document | Scope |
|----------|-------|
| **This directory** | Target design (M1–M8) |
| [Agent-Behavior-and-Mechanics-Echo.md](../Agent-Behavior-and-Mechanics-Echo.md) | Phase 1 as-built (`persona_prompts`, worker `agent-turn`, affinity score) |
| [Software-Architecture-Echo.md](../Software-Architecture-Echo.md) | High-level architecture (§8.2 four-layer prompt goal) |

---

## Cursor integration

- **Skill:** `.cursor/skills/agent-platform/SKILL.md` — read before implementing agent-platform code.
- **Rule:** `.cursor/rules/agent-platform.mdc` — invariants (style vs memory, topic archive rules, promote pipeline).

---

## Milestones

| Milestone | Scope |
|-----------|-------|
| **M0** | This documentation package |
| **M1–M8** | See [implementation-milestones.md](./implementation-milestones.md) |
