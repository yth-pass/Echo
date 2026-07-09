# Agent Platform Mechanisms

| Field | Value |
|-------|-------|
| **Related** | [architecture.md](./architecture.md), [storage-schema.md](./storage-schema.md) |

Complete list of **22 mechanisms**: design goal, implementation, storage path.

---

## Mechanism table

| # | Mechanism | Design goal | Implementation | Storage |
|---|-----------|-------------|----------------|---------|
| 1 | Shared skill base | Unified capabilities, upgradable without per-user copies | `shared-agent/SKILL.md` + references + scripts + evals; server Loader reads files | `shared-agent/` |
| 2 | User style | Replies sound like the user | Onboarding → `style.md`; inject every turn as L2 | `users/{id}/style.md` |
| 3 | Layered Prompt Composer | Token control, progressive disclosure, fewer hallucinations | Assemble L0–L8 + overlay; retrieve L4–L6 on demand | Runtime (no file) |
| 4 | Core profile | Always know who the user is | Small fixed JSON injected as L3 | `memory/users/{id}/profile.core.json` |
| 5 | Semantic facts (self) | Long-term retrievable facts about self | JSONL + embedding/keyword search | `memory/users/{id}/semantic/facts.jsonl` |
| 6 | Episodic memory (self) | Remember events with timeline | JSONL + time-biased retrieval | `memory/users/{id}/episodic/events.jsonl` |
| 7 | Social objective facts ① | Other Agent's explicit verifiable statements (incl. third parties) | Append-only JSONL per (observer, other) | `social/by_agent/{id}/objective_facts.jsonl` |
| 8 | Social preferences ② | Opinions, implicit/unconfirmed inferences | Append-only JSONL; lower confidence for inferred | `social/by_agent/{id}/preferences.jsonl` |
| 9 | ②→① promote | Don't treat guesses as facts; promote on explicit confirmation | PromoteCheck after turns/topics; move ②→① atomically | Same paths + status fields |
| 10 | Main/sub topics ③ | Sustained main thread + returnable digressions | `current_topic.json`: main + active_sub + subtopic_history | `joint_sessions/` or `sessions/` |
| 11 | Topic transitions | Distinguish continue / digress / return / new main | TopicJudge: 5 transition types | Updates `current_topic.json` |
| 12 | Topic history archive | Don't lose content on new main topic | `new_main` → `topic_history.jsonl`; `return_to_main` → sub to history | `topic_history.jsonl` |
| 13 | Joint session | A↔B share one topic file | Single `current_topic.json` per joint session | `memory/joint_sessions/{id}/` |
| 14 | Session summary + window | Multi-turn coherence without unbounded context | Summary + last N turns; full turns archived | `summary.md`, `turns.jsonl` |
| 15 | Memory extraction pipeline | Persist chat into structured memory | Async LLM extract → dedupe → write jsonl | Jobs + jsonl files |
| 16 | Observer-relative memory | A's knowledge ≠ B's official profile | All social paths include observer_id; dual extract after joint chat | Per-observer paths |
| 17 | Affection / relationship | A's attitude toward B affects how A speaks to B | Four dimensions + events + rule-based deltas | `affection.json`, `affection_events.jsonl` |
| 18 | Relationship overlay | Different tone per counterparty without changing global style | Inject relationship_label block when other in participants | Composer runtime |
| 19 | Safety & privacy | No unauthorized disclosure; safety highest priority | L0 safety + visibility + share_policy filter | `references/safety.md` |
| 20 | Style onboarding | New users get usable Agent quickly | Client collects; server generates style + memory candidates | Onboarding API |
| 21 | Evals | Regression on style, memory, topics, affection | CI runs shared evals; not per user chat | `shared-agent/evals/` |
| 22 | Server skill loader | Use real skill files on server | Read SKILL.md + compose; not Cursor IDE discovery | Loader in worker/api |

---

## LLM / rule modules

| Module | Serves mechanisms |
|--------|-------------------|
| Style Generator | 2, 20 |
| Prompt Composer (code) | 3, 18, 22 |
| MemoryRetrieve (code) | 4, 5, 6, 7, 8 |
| TopicJudge | 10, 11, 12 |
| SocialExtract / MemoryExtract | 7, 8, 5, 6, 15 |
| PromoteCheck | 9, 17 (trust) |
| RelationshipExtract | 17 |
| AffectionApply (rules) | 17, 18 |

---

## MVP rollout (summary)

| Phase | Mechanisms |
|-------|------------|
| MVP | 1, 2, 3, 4, 10, 11, 14, 19, 22 |
| V2 | 5, 6, 7, 8, 12, 13, 15, 16 |
| V3 | 9, 17, 18 |
| V4 | 21, decay/repair, optional Pass2 style rewrite |

Full detail: [implementation-milestones.md](./implementation-milestones.md).
