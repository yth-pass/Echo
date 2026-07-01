# Echo — Onboarding Survey Design (Four-Layer Persona Model)

| Field | Value |
|-------|-------|
| **Document Version** | 2.0.0 |
| **Status** | Active |
| **Related** | [Onboarding Survey Redesign Proposal](./Onboarding-Survey-Redesign-Proposal.md), [PRD §7.2](./PRD-Echo.md), [Software Architecture §8.2](./Software-Architecture-Echo.md), [Phase 1 Roadmap](./Phase1-Demo-Roadmap-Echo.md), [Agent Behavior & Mechanics](./Agent-Behavior-and-Mechanics-Echo.md) |

## Design Philosophy

v2.0 upgrades to the "Four-Layer Persona Collection Model", building a more "like you" digital clone by covering four dimensions of the user's mental model (see [Redesign Proposal](./Onboarding-Survey-Redesign-Proposal.md)):

- **M1 Identity Baseline** — let the clone know who you are and your social role
- **M2 Voice Print (with relationship-context layer)** — let the clone speak like you and adapt across intimacy levels
- **M3 Belief System** — let the clone think your way and know your social boundaries
- **M4 Deep Dialogue** — fill blind spots, capture contradictions, collect real language samples

Inspiration:
- **Hinge / Bumble prompts** — one question per screen; concrete scenario options over long forms.
- **Replika-style voice profiling** — adjective tags + user verbatim samples (upgraded to evidence-backed tags).
- **FR-011** — structured survey followed by a short AI dialogue to capture unstructured tone.

## Client Flow (`echo` onboarding wizard)

Progress is shown per "module" (M1/M2/M3/Consent/M4/Incubate); each module has multiple sub-steps, one to two questions per screen, all open-text fields are "optional but strongly recommended".

1. **M1 Identity Baseline** (6 steps)
   - Basics: nickname, city, goal, occupation/domain
   - How friends describe you (open text)
   - A typical day (open text)
   - Interests & passions (1–4 tags + optional "why" per interest)
   - An experience that changed you (open text, optional)
   - Social role: stranger-comfort slider (reserved↔outgoing), friend role, group role
2. **M2 Voice Print (with relationship context)** (6 steps)
   - 2–3 tone tags + one real verbatim evidence per tag
   - 6 language scenarios (weekend invite / disagreement / icebreak / sharing excitement / comforting a friend / venting), each with an embedded relationship-context follow-up
   - Free writing: send a message to your best friend (≥20 chars recommended)
   - 3 catchphrases
   - Chat habits (multi-select: punctuation / emoji / short messages / voice notes)
   - Emotional patterns (what you need when down / how you express when happy)
3. **M3 Belief System** (6 steps)
   - Relationship view + conflict view (with Why follow-up) + relationship dealbreaker
   - Trust view, happiness view (open text)
   - 4 daily-opinion probes (effort payoff / social-media perfectionism / lending money / rarest quality, with optional Why)
   - Something you changed your mind about
   - Signal of being understood + trigger that shuts you down
4. **Clone Consent**
5. **M4 Deep Dialogue** — on entry **`POST /onboarding/dialogue/start`** clears history; **6–12 user turns** via `POST /onboarding/dialogue/turn` (min 6, recommended 8–10, max 12; Enter to send). The AI acts as a "curious interviewer" across four stages: warm-up (1-2) / contradiction probing (3-5) / deep topics (6-9) / wrap-up (10-12), personalizing follow-ups based on M1–M3 answers.
6. **Incubate** — entering this step auto-triggers `POST /onboarding/finalize` (creates clone, welcome post, `match-daily` queue; generates four-layer persona + style.md; returns a new JWT); at least 5s of "incubating" before **Enter Plaza** becomes available.

## Canonical JSON (`surveyJson` / `Profile.bioJson`)

All new fields are optional, backward compatible with legacy survey data.

| Field | Type | Module | Purpose |
|-------|------|--------|---------|
| `displayName` | string | M1 | Plaza display name |
| `city` | string | M1 | Matching / persona |
| `goal` | string | M1 | Dating goal |
| `occupation` | string | M1 | Topic depth / persona |
| `selfDescription` | string | M1 | How friends see me (social-persona anchor) |
| `dailyRoutine` | string | M1 | Life rhythm / context |
| `interests` | string[] | M1 | Matching |
| `interestContexts` | Record<string,string> | M1 | "Why" per interest |
| `keyExperience` | string | M1 | An experience that changed me |
| `socialSpectrum` | `{ strangerComfort?: number; friendRole?: string; groupRole?: string }` | M1 | Social-role baseline |
| `styleReplies` | `{ scenarioId, choiceId, text, relationContext? }[]` | M2 | Voice-imitation seed + relationship context |
| `toneTags` | `string[] \| { tag, evidence? }[]` | M2 | Tone (backward compatible with legacy string[]) |
| `freeWritingSample` | string | M2 | Free-writing sample (linguistic-analysis material) |
| `catchphrases` | string[] | M2 | Catchphrase list |
| `chatHabits` | `{ usesPunctuation?, likesEmoji?, prefersShortMessages?, sendsVoiceMessages? }` | M2 | Typing feel |
| `emotionalPatterns` | `{ badMoodNeed?, happyExpression? }` | M2 | Emotional-reaction pattern |
| `caringStyle` | string | M2 | How you show care to people who matter |
| `valuesChoices` | `{ questionId, choiceId, label }[]` | M3 | Values |
| `valuesWhy` | Record<string,string> | M3 | Reason per value choice |
| `trustView` | string | M3 | Trust view |
| `happinessView` | string | M3 | Happiness view |
| `opinionProbes` | `{ questionId, choiceId?, label?, reason? }[]` | M3 | Daily-opinion probes |
| `changedMind` | string | M3 | Something I changed my mind about |
| `feelingHeardSignal` | string | M3 | Signal of being understood |
| `shutDownTrigger` | string | M3 | Trigger that shuts me down |
| `sampleMessage` | string? | compat | Deprecated, merged into `catchphrases` |
| `extra` | Record | compat | Fallback (e.g. `relationshipDealbreaker`) |

Implementation: [`services/api/src/onboarding/survey-schema.ts`](../services/api/src/onboarding/survey-schema.ts).

## Persona Runtime

On `POST /onboarding/finalize`, the API builds a four-layer survey seed (`buildPersonaSeedFromSurvey`, emits an M1–M3 structured summary) and calls the LLM to generate `persona_prompts.prompt_text`; meanwhile `StyleGeneratorService` produces an upgraded `style.md` (adds **Adaptation** relationship-switching, **Boundaries** social-boundary, and **Avoid.Contradictions** contradiction-marker sections), creates an `active` `digital_clones`, and enqueues the `welcome` post and `match-daily`. Workers later use this persona in `agent-turn` (clone-to-clone chat) and `post-draft` (plaza). Full flow, limitations, and code index in [Agent-Behavior-and-Mechanics-Echo.md](./Agent-Behavior-and-Mechanics-Echo.md) §1.

## Existing Users

`POST /auth/login` and `GET /auth/me` return `onboardingComplete`. When `true`, the client skips the wizard and enters the main UI.

## Demo NPCs

Seed users `13800000001` / `13800000002` use the **same JSON structure** as real users (Lin Xi's clone / Chen Mo's clone). See [`services/api/prisma/seed.ts`](../services/api/prisma/seed.ts).
