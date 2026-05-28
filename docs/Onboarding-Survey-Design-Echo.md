# Echo — Onboarding Survey Design (Phase 1)

| Field | Value |
|-------|-------|
| **Document Version** | 1.0.0 |
| **Status** | Active |
| **Related** | [PRD §7.2](./PRD-Echo.md), [Software Architecture §8.2](./Software-Architecture-Echo.md), [Phase 1 Roadmap](./Phase1-Demo-Roadmap-Echo.md) |

## Inspiration

- **Hinge / Bumble prompts** — one question per screen; concrete scenario choices instead of long forms.
- **Replika-style tone capture** — adjective tags + sample utterance.
- **FR-011** — short AI dialogue after structured survey to capture non-structured tone.

## Client flow (`echo` Onboarding wizard)

1. Basics — city, goal, interests (chips)
2. Language style — 3 scenario reply picks
3. Tone tags — pick 2–3 from preset list
4. Optional sample message
5. Values — 2 forced-choice questions
6. Consent
7. AI dialogue — **`POST /onboarding/dialogue/start`** clears prior turns; **4–8 user turns** via `POST /onboarding/dialogue/turn` (UI: suggest 4–6, max 8; Enter to send)
8. Finalize — auto `POST /onboarding/finalize` on step entry (clone + welcome post + `match-daily` queue); fresh JWT returned; min 5s incubation UI before **进入广场**

## Canonical JSON (`surveyJson` / `Profile.bioJson`)

| Field | Type | Purpose |
|-------|------|---------|
| `displayName` | string | Feed display |
| `city` | string | Matching / persona |
| `goal` | string | Dating intent |
| `interests` | string[] | Matching |
| `styleReplies` | `{ scenarioId, choiceId, text }[]` | Language mimic seed |
| `toneTags` | string[] | Persona tone |
| `sampleMessage` | string? | Raw style sample |
| `valuesChoices` | `{ questionId, choiceId, label }[]` | Rules + persona |

Implementation: [`services/api/src/onboarding/survey-schema.ts`](../services/api/src/onboarding/survey-schema.ts).

## Returning users

`POST /auth/login` and `GET /auth/me` return `onboardingComplete`. When `true`, the client skips the wizard and opens the main tabs.

## Demo NPCs

Seed users `13800000001` / `13800000002` use the **same JSON shape** as real users (林溪的分身 / 陈默的分身). See [`services/api/prisma/seed.ts`](../services/api/prisma/seed.ts).
