# Echo — Agent Instructions

## Documentation

- **English (canonical for engineering):** [`docs/`](docs/) — index: [`docs/README.md`](docs/README.md)
- **Simplified Chinese mirrors:** [`docs_CN/`](docs_CN/) — index: [`docs_CN/README.md`](docs_CN/README.md)
- **Repository overview (zh-CN):** [`README.md`](README.md)

When you create, edit, rename, or delete any file under `docs/`, apply the project skill **docs-cn-mirror** and update the matching file under `docs_CN/` with the same structure (translate prose only; keep `FR-xxx`, API paths, and code unchanged).

A `postToolUse` hook (`.cursor/hooks/sync-docs-cn.py`) injects a reminder after `Write` operations on `docs/**/*.md`.

## Phase 1 full-function demo (before APK)

- **Roadmap (canonical checklist):** [`docs/Phase1-Demo-Roadmap-Echo.md`](docs/Phase1-Demo-Roadmap-Echo.md) — one row per feature (`P1-xx`). Update **per-layer** columns only: `API` | `Worker` | `Web` | `APK` (v1.1.0; do not use a single row-wide `done`).
- **Web sprint summary (non-authoritative):** [`echo/docs/PHASE1-SCOPE-MAP.md`](echo/docs/PHASE1-SCOPE-MAP.md) — links to the roadmap; do not track implementation status here alone.
- **Deployment boundaries:** [`docs/Deployment-and-Component-Boundaries-Echo.md`](docs/Deployment-and-Component-Boundaries-Echo.md).
- **Skill:** **echo-deployment-boundaries** — read before editing `echo/`, `services/`, `infra/`, or `apps/`.
- **Hook:** `.cursor/hooks/phase1-context-nudge.py` — reminders after `Write` under those paths or roadmap docs.

Demo sequence: real local/staging API + workers → validate on [`echo/`](echo/) client → then [`apps/android`](apps/android/) APK. Mock in the client is fallback only, not a substitute for `services/*` implementation.

When you create, edit, or delete files under `echo/`, apply the project skill **echo-deployment-boundaries** so Phase 1 platform work stays aligned with deployment docs and the demo roadmap.

A `postToolUse` hook (`.cursor/hooks/phase1-context-nudge.py`) injects context after relevant `Write` operations (`echo/`, `services/`, `infra/`, `apps/`, Phase 1 roadmap markdown).

## Git push to GitHub

- **Skill:** **git-push-github-ssh** — push only via SSH from **CMD** (not Git Bash); see skill for `ssh -T`, `git remote set-url`, and `git push origin main`.
- **Script:** [`.cursor/scripts/git-push-echo.cmd`](.cursor/scripts/git-push-echo.cmd) — one-shot push from `C:\Users\天昊\Desktop\Echo`.
- **Hooks:** `beforeShellExecution` blocks naive agent `git push`; `postToolUse` reminds after `git commit` to use the SSH workflow.
