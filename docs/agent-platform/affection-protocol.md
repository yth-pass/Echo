# Affection Protocol

| Field | Value |
|-------|-------|
| **Related** | [storage-schema.md](./storage-schema.md), [schemas/affection.schema.json](./schemas/affection.schema.json), [memory-lifecycle.md](./memory-lifecycle.md) |

Relationship scores between observer Agent and other Agent. **A→B and B→A are independent.**

---

## 1. Purpose

Model how clone A **feels about** clone B for:

- Tone when addressing B (relationship overlay)
- Trust calibration when citing B's ①② memory
- Not conflated with match-list compatibility % (Phase 1 `affinity_scores.score`)

---

## 2. Four dimensions (0–100)

| Dimension | Meaning |
|-----------|---------|
| **familiarity** | Exposure, conversation length, how long known |
| **warmth** | Emotional friendliness, positive engagement |
| **trust** | Reliability of statements; promote/contradict linkage |
| **tension** | Conflict, friction, negative exchanges |
| **tension_quality** | `situational` (short-term friction) or `structural` (deep, persistent distrust); default `situational` |

**`tension_quality` (R1):** Separates *how* tension should decay, not the numeric tension score. `situational` marks routine conflict (`conflict`) that may fade with time; `structural` marks deep breaches (`insult_or_rude`, `trust_break`) that block auto-decay until repaired. Set on apply when an event produces positive tension delta; `structural` never downgrades to `situational` during apply (only decay resets quality when `structural` and tension is already 0).

**Composite (default weights):**

```
composite_affinity =
  0.25 * familiarity
+ 0.35 * warmth
+ 0.30 * trust
- 0.40 * tension
```

Clamp each dimension 0–100; clamp composite 0–100.

---

## 3. relationship_label mapping

Numeric label from `computeLabel` uses **strict priority** (first match wins):

| Priority | Label | Condition |
|----------|-------|-----------|
| 1 | `strained` | tension ≥ 50, or (warmth < 25 and familiarity ≥ 15) |
| 2 | `distant` | trust ≤ 40 and tension ≥ 40 and familiarity < 20 |
| 3 | `friendly_but_cautious` | trust ≥ 25 and warmth ≥ 40 and tension ≥ 25 |
| 4 | `close` | composite ≥ 75 and trust ≥ 70 and tension < 20 |
| 5 | `good_terms` | composite ≥ 60 and tension < 30 |
| 6 | `friendly_acquaintance` | composite ≥ 40 |
| 7 | `stranger` | familiarity < 15 |
| 8 | `acquaintance` | default fallback |

After `computeLabel`, `applyHysteresis` may hold the prior label when composite is near a threshold (see §6b). B-layer event gates (`checkLabelUpgrade` / `checkLabelDowngrade`) and C-layer LLM judge may further block label changes.

Inject **label + behavioral hints** in overlay, not raw numbers (optional admin UI may show numbers).

---

## 4. Event-sourced updates

**Do not** let LLM output "+5 warmth" directly each turn.

```mermaid
flowchart LR
    Topic[Topic or session end]
    RE[RelationshipExtract LLM]
    EVT[affection_events.jsonl]
    Rules[AffectionApply rules]
    AFF[affection.json]
    Topic --> RE --> EVT --> Rules --> AFF
```

---

## 5. event_type and default deltas

| event_type | Default deltas | Notes |
|------------|----------------|-------|
| `positive_engagement` | familiarity +2, warmth +2 | Long back-and-forth |
| `compliment` | warmth +3, familiarity +1 | |
| `helpful_share` | warmth +2, trust +2 | |
| `agreement` | warmth +2 | |
| `conflict` | tension +5, warmth -3 | From topic valence=negative |
| `insult_or_rude` | tension +10, warmth -8 | |
| `apology_or_repair` | tension -6, warmth +3 | |
| `trust_confirm` | trust +4 | ②→① promote |
| `trust_break` | trust -8, tension +3 | ② contradicted |
| `deep_share` | trust +3, warmth +2 | Sensitive personal share |
| `collaborative_success` | trust +3, familiarity +1 | Joint task succeeded |
| `support_received` | trust +4, warmth +2 | Other party helped observer |
| `support_given` | trust +3, warmth +1 | Observer helped other party |
| `explicit_bond` | warmth +5 (cap) | "We're good friends" — max +5 per session |
| `session_contact` | familiarity +1 | Per joint session (cap +3/day pair) |
| `value_alignment` | warmth +4, trust +3 | Shared values / worldview |
| `preference_match` | warmth +3, trust +2 | Taste / preference alignment |

**Tension quality rules** (set on apply when tension delta > 0; `structural` > `situational`, never downgrades):

| event_type | tension_quality |
|------------|-----------------|
| `conflict` | `situational` |
| `insult_or_rude` | `structural` |
| `trust_break` | `structural` |
| (others) | `situational` |

`apology_or_repair` reduces tension but does not clear `structural` quality; decay resets quality to `situational` only when `tension_quality === 'structural'` and tension is 0.

**Caps:**

- Per topic: sum |delta| on warmth ≤ 8
- Per session (pair): sum |delta| on composite ≤ 15
- `explicit_bond` cannot alone reach `close`; requires sustained interaction

---

## 6. Decay (background job)

`runAffectionDecay` applies time-based decay from days since `last_interaction_at` (idempotent per contact gap).

| Dimension | Trigger (no contact) | Rate | Floor |
|-----------|----------------------|------|-------|
| familiarity | ≥ 7 days | -1/week | 10 if ever met, else 0 |
| warmth | ≥ 14 days | -1/week (-0.5/week when trust ≥ 70) | 0 |
| trust | ≥ 30 days | -2/week (×1.5 when `repair_arc.trust_break_count` > 3) | 10 if peak trust ≥ 30, else 0 |
| tension | ≥ 14 days | -2/week | 0 |

**Tension exception:** when `dimensions.tension_quality === 'structural'`, tension does not auto-decay (deep distrust persists). When `tension_quality === 'situational'`, tension decays at -2/week from 14 days no contact. If decay runs while `tension_quality === 'structural'` and tension is already 0 (e.g. cleared by apology), quality resets to `situational`.

### 6b. Label hysteresis

`applyHysteresis` reduces label oscillation on the positive ladder (`stranger` → `close`):

- **Upgrade lag:** composite must reach **110%** of the target label threshold (e.g. friendly_acquaintance → good_terms needs composite ≥ 66, not 60).
- **Downgrade resistance:** composite must fall to **90%** of the prior label threshold (e.g. close → good_terms needs composite ≤ 67.5).

**Exemptions (no hysteresis):** `strained` when tension ≥ 50; `stranger` → `acquaintance` initial upgrade.

### 6c. Trust repair arc

Stored on `AffectionState.repair_arc` (not in `dimensions`):

| Field | Meaning |
|-------|---------|
| `trust_break_count` | Cumulative `trust_break` events |
| `positive_interactions_since_break` | Positive trust events since last break |
| `is_in_repair_arc` | Whether dampened trust gains apply |

After `trust_break`, positive trust events (`trust_confirm`, `deep_share`, `collaborative_success`, `support_received`, `support_given`) multiply **trust gain only**:

| Interactions since break | Trust gain multiplier |
|--------------------------|----------------------|
| 1–3 | × 0.50 |
| 4–6 | × 0.75 |
| 7+ | × 1.00 (arc ends) |

`trust_break` negative deltas are never dampened. Trust does not auto-restore to pre-break levels; recovery builds from the new baseline. Another `trust_break` during the arc resets the interaction counter to 0.

**Overlay repair arc transparency (R3):** When `is_in_repair_arc === true`, `AffectionOverlayService.render` augments the relationship overlay:

- **Tone:** appends `REPAIR ARC (progress/7): trust is fragile.` plus stage hint — Early rebuilding (remaining > 4), Mid-recovery (remaining 3–4), Nearly rebuilt (remaining ≤ 2).
- **Repair Arc line:** `- Repair Arc: {progress}/7 positive interactions toward trust recovery` (only while arc active).
- **Trust:** appends `(REPAIR ARC — gains dampened, must earn back trust gradually)`.

When the arc ends (`is_in_repair_arc === false`), overlay returns to label-only hints with no repair lines.

---

## 7. Trust linkage with memory

| Memory event | Affection event |
|--------------|-----------------|
| ②→① promote | `trust_confirm` |
| ② contradicted | `trust_break` |
| B shares sensitive info A treats well | optional `warmth` +1 (RelationshipExtract) |

---

## 8. Relationship overlay (Composer)

When `participants` includes `other_agent_id`:

```markdown
## Relationship with {other_agent_id}
- Label: friendly_acquaintance
- Tone: Warm but light — friendly tone, avoid deep personal leaps
- Trust: moderate — confirm before stating ② inferred items as facts
- Tension: low — tone may be relaxed
- Never disclose items with share_policy do_not_repeat_to_subject
```

Each of the 8 labels has a dedicated **Tone** hint in `AffectionOverlayService` (e.g. `friendly_but_cautious`: warm surface, guarded trust — friendly tone but verify before treating inferences as facts). Numeric `computeLabel` rule 3: trust ≥ 25, warmth ≥ 40, tension ≥ 25. When `repair_arc.is_in_repair_arc`, see §6c overlay transparency (R3).

---

## 9. Bidirectional updates

One joint session turn may produce:

- Event on A→B (B complimented A → A's warmth↑ toward B)
- Event on B→A (A was cold → B's warmth↓ toward A)

Extract from **each observer's perspective**.

---

## 10. Phase 1 Echo note

Today: single `affinity_scores.score` on session end. Target: per-pair `affection.json` persisted beyond one session, fed by events above. See [echo-mapping.md](./echo-mapping.md).

---

## 11. M6 Enhancement (A+B+C model)

- **A (Dimension-dependent delta)**: `getStateDependentDelta` applies non-linear scaling (e.g. warmth gain diminishes at high warmth).
- **B (Threshold upgrade)**: `checkLabelUpgrade` enforces `LABEL_THRESHOLDS` (mustHaveEvent, minPositiveEvents, dimension requirements) before allowing label change.
- **C (LLM judge)**: `RelationshipUpgradeJudgeService` performs secondary semantic check for high-value or large-delta upgrades.
- RelationshipExtract now accepts `priorState` and uses expanded multi-step prompt for incremental, state-aware event extraction.
- All changes preserve observer-relative storage and non-blocking execution.

**Refined B (Threshold) rules (M6 v2):**
- good_terms requires explicit_bond + min 4 positive events.
- close requires explicit_bond + value_alignment + min 6 positive events + 2 distinct topics.
- New event types value_alignment and preference_match carry dedicated deltas and are recognized by RelationshipExtract.

**Phase 1 (Numeric Dynamic Threshold)**: `getEffectiveThreshold` now uses stage-specific relaxation tables (good_terms vs close have different base relaxations) and strength-aware bonuses (weak/moderate/strong) for critical events. Relaxation also scales with the count of critical events within the batch.

**Phase 2 (Event Directionality)**: `RelationshipExtractService` now supports `extractFromObserver` flag. `explicit_bond`/`value_alignment` are only extracted from the observer's own turns; all other event types are only extracted from the other party's turns. `main.ts` performs two extractions per direction and merges results before applying.

---

## 12. 8-Label Complete Transition Table (M6)

All 8 `RelationshipLabel` values now have explicit numeric + event-based transition rules (bidirectional).

**Upgrade paths (positive labels):**

| From → To | Required Dimensions (base) | Must-Have Event(s) | Min Positive Events | Min Distinct Topics | Notes |
|-----------|----------------------------|--------------------|---------------------|---------------------|-------|
| any → acquaintance | familiarity ≥15, warmth≥25, trust≥20, tension≤50 | — | — | — | Base numeric gate |
| acquaintance → friendly_acquaintance | familiarity≥20, warmth≥40, trust≥35, tension≤35 | — | 1 | — | Single positive event suffices |
| friendly_acquaintance → good_terms | familiarity≥40, warmth≥55, trust≥50, tension≤30 | `explicit_bond` | 4 | — | `explicit_bond` required; relaxation applies on critical events |
| good_terms → close | familiarity≥60, warmth≥70, trust≥70, tension≤20 | `explicit_bond` + `value_alignment` | 6 | 2 | Strongest gate; multi-topic + dual critical events |

**Downgrade paths (negative / cautious labels):**

| From → To | Required Dimensions (bad) | Must-Have Event(s) | Min Negative Events | Notes |
|-----------|---------------------------|--------------------|---------------------|-------|
| any → strained | trust ≤30, tension ≥60 | `conflict` / `insult_or_rude` / `trust_break` | 2 | Severe breakdown |
| any → distant | trust ≤40, tension ≥40 | `conflict` | 1 | Repeated friction |
| any → friendly_but_cautious | trust ≤25, tension ≥45, warmth ≤20 | `trust_break` | 1 | Mixed signals (positive engagement followed by breach) |

**Key rules applied in `checkLabelUpgrade` / `checkLabelDowngrade`:**

- If no rule defined for target label → allowed (computeLabel fallback for extreme tension cases).
- Dynamic relaxation only for upgrades to `good_terms`/`close`/`friendly_acquaintance` when critical events (`explicit_bond`, `value_alignment`) present; strength (`weak/moderate/strong`) and per-event bonuses scale the relaxation.
- LLM judge (C) still applies only to high-value upgrades after numeric+event gates pass.
- Downgrades do not use relaxation; negative events directly enforce the thresholds.

This completes the 8-label transition model for Phase 1 demo.

---

## 13. Reciprocity weak coupling (R2)

Optional one-way signal: observer A's warmth **delta** toward B may be scaled by B's recent warmth change toward A. **A→B and B→A numeric dimensions remain independent**; only the warmth increment on apply is adjusted.

| Config (`ReciprocityConfig`) | Default | Meaning |
|------------------------------|---------|---------|
| `enabled` | `false` | Master switch (backward compatible) |
| `maxMultiplier` | `1.20` | Max boost when counterparty warmed up |
| `minMultiplier` | `0.80` | Dampen when counterparty turned cold |
| `warmthDropThreshold` | `15` | Counterparty in-window warmth drop must exceed this to dampen |

**When active (joint session / counterparty state readable):**

- Read `otherId → observerId` affection; require `last_interaction_at` within **7 days**.
- Compute counterparty **in-window warmth delta** (sum of warmth deltas from events in the last 7 days).
- If counterparty warmed (`otherWarmthDelta > 0`) and observer warmth delta > 0 → multiply by up to `maxMultiplier` (boost capped at +20%).
- If counterparty cooled (`otherWarmthDelta < -warmthDropThreshold`) and observer warmth delta > 0 → multiply by `minMultiplier`.
- If counterparty cooled and observer warmth delta < 0 → multiply negative delta by `maxMultiplier` (friction amplifies).

Implemented in `reciprocity.service.ts` (`computeReciprocityMultiplier`) and `AffectionApplyService.apply` (after event aggregation, before per-topic warmth cap). Does not affect trust, tension, familiarity, or composite directly.
