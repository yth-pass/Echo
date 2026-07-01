# Echo Engineering Documentation

| Field | Value |
|-------|-------|
| **Canonical language** | English (`docs/`) |
| **Simplified Chinese mirror** | [`docs_CN/`](../docs_CN/) |
| **Repository overview** | [`README.md`](../README.md) (zh-CN monorepo guide) |
| **Agent instructions** | [`AGENTS.md`](../AGENTS.md) |

This directory holds product and engineering blueprints. **Implementation status** for Phase 1 is tracked in the feature matrix—not in the PRD or architecture docs alone.

---

## Document index

| File | Description |
|------|-------------|
| [PRD-Echo.md](./PRD-Echo.md) | Product requirements (MVP scope, `FR-xxx`) |
| [Software-Architecture-Echo.md](./Software-Architecture-Echo.md) | Layered architecture, C4, API sketch |
| [Deployment-and-Component-Boundaries-Echo.md](./Deployment-and-Component-Boundaries-Echo.md) | Deployment topology and component boundaries |
| [Phase1-Demo-Roadmap-Echo.md](./Phase1-Demo-Roadmap-Echo.md) | **Phase 1 canonical checklist** (`P1-xx`, `API` \| `Worker` \| `Web` \| `APK`) |
| [Onboarding-Survey-Design-Echo.md](./Onboarding-Survey-Design-Echo.md) | Onboarding survey and dialogue design |
| [Clone-Runtime-and-Triggers-Echo.md](./Clone-Runtime-and-Triggers-Echo.md) | Clone runtime, queues, LLM triggers |
| [Agent-Behavior-and-Mechanics-Echo.md](./Agent-Behavior-and-Mechanics-Echo.md) | **Agent mechanics** — persona mimicry, matching, chat, posts, affinity (Phase 1 as-built) |
| [agent-platform/](./agent-platform/README.md) | **Agent platform target design** — shared skill, style.md, layered memory, topics, affection (M1–M8) |
| [Campus-Pilot-Launch-Plan-Echo.md](./Campus-Pilot-Launch-Plan-Echo.md) | Campus pilot GTM and release gates |
| [Strategic-Update-Plan-Echo.md](./Strategic-Update-Plan-Echo.md) | **CEO strategic update plan** — Part I (CEO §1–§13) + Part II (CTO §14–§26) + Part III (CMO §27–§41) |
| [Echo-Delightful-Experience-Design.md](./Echo-Delightful-Experience-Design.md) | **Delightful experience design** — Anticipation Loop, Trust Dashboard, Handoff ceremony, Clone nurture, microcopy |
| [glossary.md](./glossary.md) | Terminology |

**Chinese mirror:** same filenames under [`docs_CN/`](../docs_CN/). See [`docs_CN/README.md`](../docs_CN/README.md).

---

## Which doc to read first

| Goal | Start here |
|------|------------|
| Local full-stack demo | [Phase1-Demo-Roadmap-Echo.md](./Phase1-Demo-Roadmap-Echo.md) §2, then [`README.md`](../README.md) §7 |
| What to build next | Roadmap §3.2 matrix (one row at a time) |
| Why / what (product) | [PRD-Echo.md](./PRD-Echo.md) |
| Executive strategy & sequencing | [Strategic-Update-Plan-Echo.md](./Strategic-Update-Plan-Echo.md) |
| How systems fit together | [Software-Architecture-Echo.md](./Software-Architecture-Echo.md) |
| 部署边界与组件 | [Deployment-and-Component-Boundaries-Echo.md](./Deployment-and-Component-Boundaries-Echo.md) |
| How Agents match, chat, post, score affinity (Phase 1 code today) | [Agent-Behavior-and-Mechanics-Echo.md](./Agent-Behavior-and-Mechanics-Echo.md) |
| Agent platform target (memory, topics, Composer) | [agent-platform/README.md](./agent-platform/README.md) |
| Web prototype scope only | [`echo/docs/PHASE1-SCOPE-MAP.md`](../echo/docs/PHASE1-SCOPE-MAP.md) (summary; roadmap is authoritative) |

**As-built vs target:** [Agent-Behavior-and-Mechanics-Echo.md](./Agent-Behavior-and-Mechanics-Echo.md) describes the **current codebase**. [agent-platform/](./agent-platform/README.md) describes the **target design** to implement in milestones M1–M8. Gap analysis: [agent-platform/echo-mapping.md](./agent-platform/echo-mapping.md).

---

## Maintenance

- Edit English files in `docs/` first; sync [`docs_CN/`](../docs_CN/) via skill **docs-cn-mirror** (translate prose only; keep `FR-xxx`, API paths, code).
- Update roadmap **layer columns** (`API`, `Worker`, `Web`, `APK`) when landing a feature—do not use a single row-wide `done`.
- **App UI language:** Simplified Chinese (PRD §12).
