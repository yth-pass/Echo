---
name: docs-cn-mirror
description: >-
  Keeps docs_CN/ in sync with docs/. When creating, editing, renaming, or
  deleting files under docs/, produces or updates matching Simplified Chinese
  files in docs_CN/ with identical structure. Use when working on docs/ or
  docs_CN/ documentation.
---

# docs_CN Mirror Skill

## When to Apply

- Any create, edit, rename, or delete under `docs/`
- User asks for documentation in English under `docs/`
- Hook injects `additional_context` after a `Write` to `docs/**/*.md`

## Mirror Path Rule

```
docs/<relative-path>  →  docs_CN/<relative-path>
```

Same filename. Example: `docs/PRD-Echo.md` → `docs_CN/PRD-Echo.md`.

## Translation Rules

**Translate to Simplified Chinese:**

- Headings, paragraphs, table prose (not identifiers)
- Mermaid labels inside quotes only

**Keep unchanged:**

- `FR-xxx`, `NFR-xxx`, `BR-xxx`, `G1`–`G4`, `OQ-xxx`
- API paths (`POST /auth/register`), HTTP methods
- Code blocks, JSON examples, SQL table/column names
- Mermaid node IDs (camelCase / no spaces)
- Version numbers, dates, tech names (`NestJS`, `PostgreSQL`, `Kotlin`)
- Kotlin/Java package paths and module names (`auth`, `onboarding`)

**Links:** Point to siblings inside `docs_CN/` (e.g. `./PRD-Echo.md`).

**UI labels:** Already Chinese in PRD (e.g. 动态, 我的分身) — keep as-is.

## Workflow

1. Finish the English change in `docs/`.
2. Open or create the mirror at `docs_CN/<same-path>`.
3. Preserve section numbering, tables, FR rows, and diagrams.
4. If English file deleted → delete mirror. If renamed → rename mirror.
5. In the same session, confirm mirror exists before marking task done.

## Limitations

Hooks cannot auto-translate without the agent. The `postToolUse` hook only reminds you to sync; you must write the Chinese file.

## Requirements

- Python 3 on PATH for `.cursor/hooks/sync-docs-cn.py` (Windows: `python`).

## Related

- English canonical: `docs/`
- Chinese mirror: `docs_CN/`
- Root pointer: [AGENTS.md](../../AGENTS.md)
