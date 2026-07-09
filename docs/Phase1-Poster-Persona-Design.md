# Echo Phase 1 Onboarding Poster / Shareable Result Page Design

## Design Document | Version: 1.0 | Status: Proposal

---

## 1. Background & Goals

### 1.1 Why Build a Poster Page

Echo's Phase 1 onboarding is already a rich self-discovery experience: 18 scenario cards, four-phase dialogue-based language capture, and the final synthesis of a **Persona Sketch** and an **Ideal Partner Sketch**. If a user only completes the flow once, that investment is underutilized.

A shareable result page—similar in spirit to MBTI/SBTI personality posters—serves two goals:

- **Experiential value**: Turn abstract dimension scores into a tangible, memorable visual identity. Users should feel "this gets me."
- **Viral value**: Personal keywords + ideal-partner keywords create social currency and encourage sharing / referral.

### 1.2 Difference from MBTI

Echo measures **continuous dimensions** (Big Five, Moral Foundations, attachment style, time perspective) rather than forcing users into 16 fixed types. The poster page must therefore:

- Use archetypes to create memorability, but **not imply rigid typing**;
- Use keyword clouds to preserve the richness and continuity of the dimensions;
- Include a disclaimer: *"This is your Echo Elf, not a definition of you."*

---

## 2. Core Design Principles

| Principle | Description |
|-------------|-------------|
| **Warm tech** | No cold, mechanical feel. Use rounded characters and soft gradients. |
| **Personified** | Each user receives a unique "Echo Elf" rather than a score report. |
| **Shareable** | 9:16 ratio, optimized for Moments, Xiaohongshu, and Weibo. |
| **Bidirectional** | Show both "who I am" and "who I'm looking for," echoing the ideal-partner matching mechanism. |
| **Growth-oriented** | Frame the poster as a starting point, not the final destination. |

---

## 3. Twelve Echo Elf Archetypes

Based on the Phase 1 dimensions, we design 12 optional **Echo Elf** archetypes. These are not personality types; they are **visualized temperaments** that aggregate the user's dominant dimensions.

### 3.1 Archetype Dimensions

Each archetype is defined by a weighted combination of:

- **Big Five dominant dimension**: E / O / C / N / A
- **Attachment style**: secure / preoccupied / dismissing / fearful
- **Time perspective**: future / past / present / balanced
- **Core emotional tone**: warm / exploratory / stable / sensitive / independent / protective

### 3.2 Archetype List

| Archetype | Code | Visual | Primary Color | Dominant Dimensions | Personality Keywords | Looking For | Elf Declaration |
|-----------|------|--------|---------------|---------------------|---------------------|-------------|-----------------|
| **Glow Deer** | ELF-01 | Small deer holding a glowing heart | Warm coral #FF6B6B | High A, low N, secure, present | Warm, listening, stable | Someone comfortable with quiet company | I'm not out to change the world—I just want to pass the warmth to you. |
| **Star Fox** | ELF-02 | Fox with a starry tail | Soft violet #7C5CFC | High E, high O, future-oriented | Curious, exploring, future | Someone to talk about the universe with, and actually go | The world is too big; I want to hold hands with questions and find answers. |
| **Jade Rabbit** | ELF-03 | Rabbit holding a still-water mirror | Mint teal #4ECDC4 | Low E, high C, secure, balanced | Calm, reliable, deep | Someone who reads silence without needing a performance | The crowd is too loud, but I’ll share my quiet with you. |
| **Neon Fish** | ELF-04 | Fish with shimmering neon scales | Pink-cyan gradient #FF8BA7→#4A90D9 | High E, high O, present | Vivid, spontaneous, expressive | Someone who can go wild and also get serious | Life is an improv show; I want to dance it with you. |
| **Watch Bear** | ELF-05 | Bear carrying mountain patterns | Warm amber #D4A373 | High C, high A, low N, secure | Responsible, protective, long-term | Someone ready to build a steady life together | Commitment is not a moment; it’s the choice I make every day. |
| **Dusk Butterfly** | ELF-06 | Butterfly with translucent dusk wings | Lilac #B8A9C9 | High O, high N, past-oriented | Delicate, nostalgic, creative | Someone who catches emotions and turns old days into poetry | My memory keeps a spring, and I want to walk back through it with you. |
| **Firefly Cat** | ELF-07 | Cat with a glowing tail | Bright amber #FFD166 | High E, present, playful | Playful, present, light | Someone who can laugh without overthinking the relationship | Being happy right now is my most serious answer. |
| **Listening Whale** | ELF-08 | Whale with tidal patterns | Deep blue #1A535C | High N, preoccupied, high A | Deep-feeling, sensitive, resonant | Someone who responds to every emotional tide | My heart is a sea; I need you to hear every high tide. |
| **Wind Bird** | ELF-09 | Bird with kite-shaped wings | Sky blue #87CEEB | High O, low E, dismissing, freedom-loving | Free, independent, boundaried | Someone who shines separately and still docks together | I love you, but I also love my sky. |
| **Guiding Eagle** | ELF-10 | Eagle with a lighthouse beam | Navy gold #2C3E50 / #F1C40F | High C, high O, future, high authority | Goal-driven, guiding, responsible | Someone who grows with me and accepts my protection | I want to light the path ahead and hold your hand so we don’t get separated. |
| **Moss Turtle** | ELF-11 | Turtle with a mossy shell | Sage green #A8B59A | Low E, high N, avoidant, present | Slow to warm, safety-seeking, self-contained | Someone who gives me time and space to come closer | Inside the shell is soft; I just need to know you won’t leave. |
| **Cocoon Spirit** | ELF-12 | Translucent cocoon spirit with inner light | Moon silver #E0E0E0 / iridescent #C0C0FF | High N, high O, fearful, past-oriented | Vulnerable, profound, transforming | Someone gentle and patient enough to wait for me to emerge | I wrap myself tight, but inside is all light. |

### 3.3 Archetype Mapping Rules (Algorithm Side)

Mapping is not a hard classification. It is a **weighted scoring + confidence** approach.

```typescript
// Pseudocode
function selectElfArchetype(dimensions: DimensionScores): ElfArchetypeResult {
  const candidates: Record<ElfId, number> = {};

  for (const elf of ELVES) {
    let score = 0;
    for (const rule of elf.rules) {
      const value = dimensions[rule.dimension];
      score += rule.weight * (rule.direction === 'high' ? value : -value);
    }
    candidates[elf.id] = score;
  }

  const sorted = Object.entries(candidates).sort((a, b) => b[1] - a[1]);
  const [topId, topScore] = sorted[0];
  const runnerUpScore = sorted[1][1];
  const confidence = (topScore - runnerUpScore) / (Math.abs(topScore) + 1);

  return {
    elfId: topId,
    confidence: clamp(confidence, 0, 1),
    topTwo: sorted.slice(0, 2).map(([id]) => id),
  };
}
```

**Example rule for Glow Deer (ELF-01)**:

```typescript
{
  id: 'ELF-01',
  name: 'Glow Deer',
  rules: [
    { dimension: 'agreeableness', weight: 1.2, direction: 'high' },
    { dimension: 'neuroticism', weight: 1.0, direction: 'low' },
    { dimension: 'attachmentAnxiety', weight: 0.8, direction: 'low' },
    { dimension: 'attachmentAvoidance', weight: 0.8, direction: 'low' },
    { dimension: 'timePresent', weight: 0.6, direction: 'high' },
  ],
}
```

**Confidence handling**:

- `confidence >= 0.3`: display a single archetype, e.g. *"Your Echo Elf is the Glow Deer."*
- `confidence < 0.3`: display a blend, e.g. *"A blend of Glow Deer and Star Fox"*, with a note that both temperaments live in you.

---

## 4. Personal & Ideal-Partner Keywords

### 4.1 Personal Keyword Sources

Personal keywords are extracted from the following data, with at most 2 per source and 3–5 shown in total:

| Source | Extraction Rule | Example |
|--------|-----------------|---------|
| **Big Five dominant** | Take top two absolute dimensions, direction-aware | High E → 外向; Low E → 内敛; High O → 开放 |
| **Attachment style** | Direct mapping | Secure → 稳定; Preoccupied → 依恋; Dismissing → 独立; Fearful → 复杂 |
| **Time perspective** | Highest score | Future → 前瞻; Past → 怀旧; Present → 活在当下 |
| **MFT foundations** | Top two | High care → 共情; High fairness → 公正; High authority → 秩序 |
| **User tone tags** | From M2 language fingerprint | 松弛, 直接, 温柔, 幽默, 理性, 热情 |
| **Free-text frequent words** | From Persona Sketch | 勇敢, 自由, 敏感, 真诚 |

**Example keywords**: 温暖 · 倾听 · 稳定 · 活在当下 · 真诚

### 4.2 Ideal-Partner Keyword Sources

Ideal-partner keywords are extracted from the four Ideal Partner Sketch dimensions + free text:

| Dimension | High-score keyword | Low-score keyword |
|-----------|-------------------|-------------------|
| `needEmotionalSafety` | 情感确认, 安全感, 被回应 | 独立空间, 情绪自给 |
| `needSpaceRespect` | 边界感, 独处, 个人空间 | 陪伴, 黏在一起 |
| `needDirectCommunication` | 直球, 有话直说 | 委婉, 默契, 心照不宣 |
| `needConflictResolution` | 当场解决, 不隔夜 | 冷静消化, 各自沉淀 |

**Example ideal keywords**: 情感确认 · 边界感 · 有话直说 · 不隔夜

### 4.3 De-labeling Copy

To prevent the page from feeling like a fixed label, add a small line below each keyword section:

> *"These words are your echo right now, not a definition."*

---

## 5. Poster UI Template

### 5.1 Overall Specs

| Item | Spec |
|------|------|
| Canvas ratio | 9:16 (recommended 1080 × 1920 px) |
| Background | Soft gradient based on elf primary color, with subtle sound-wave / ripple texture |
| Typography | Chinese: Source Han Sans / DingTalk JinBuTi; English: Inter / Poppins |
| Radius system | Large 24px, small 16px, tags 999px |
| Motion | Character scales in from center; keywords fade in sequentially |

### 5.2 Page Zones (Top to Bottom)

```
┌─────────────────────────────┐
│  [Echo Logo]                 │  Top: brand
│  My Echo Elf                 │
├─────────────────────────────┤
│                              │
│      [Large Elf Illustration]│  Hero: character
│      Glow Deer · ELF-01      │
│                              │
├─────────────────────────────┤
│  Your Echo                   │  Declaration
│  “I'm not out to change      │
│   the world...”              │
├─────────────────────────────┤
│  My Keywords                 │  Personal keywords
│  [Warm] [Listening] [Stable]│
│  [Present] [Sincere]         │
├─────────────────────────────┤
│  I Want to Meet              │  Ideal-partner keywords
│  [Emotional Safety]          │
│  [Boundaries]                │
├─────────────────────────────┤
│  [Radar / Dual Elf Viz]      │  Visualization (optional)
├─────────────────────────────┤
│  Generate My Clone →         │  CTA
│  Scan to discover your elf   │  QR + slogan
└─────────────────────────────┘
```

### 5.3 Zone Details

#### Top Zone (~120px)

- Left: Echo Logo (48px height)
- Right: small text "Phase 1 Onboarding Result"
- Background: frosted-glass capsule, subtle.

#### Hero Zone (~520px)

- Elf illustration centered, 70–80% width.
- Below illustration:
  - Archetype name: "Glow Deer" — 32px, bold, primary color.
  - Archetype code: "ELF-01" — 14px, 60% opacity.
- Floating small elements around illustration (hearts, stars, sound waves) for liveliness.

#### Declaration Zone (~180px)

- Subtitle: "Your Echo" (14px, gray)
- Main quote: elf declaration (24px, dark, centered)
- Decorative quotation marks in primary color at 30% opacity.

#### Personal Keywords Zone (~200px)

- Title: "My Keywords" (16px, dark)
- Tags: pill-shaped, background at 15% primary color, text at 100% primary color.
- Tag spacing 12px; padding 8px 16px; font 14px.

#### Ideal-Partner Keywords Zone (~200px)

- Title: "I Want to Meet" (16px, dark)
- Tags: pill-shaped, background at 15% complementary color, text at 100% complementary color.
- E.g., Glow Deer uses coral primary; ideal tags use deep blue or soft violet.

#### Visualization Zone (~260px, optional)

**Option A: Radar chart**
- Show Big Five or ideal-partner 4 dimensions.
- Light fill + primary-color stroke.
- Title: "My Echo Waveform"

**Option B: Dual Elf Silhouette**
- Left: user's Echo Elf; right: abstract silhouette of "the elf that fits me."
- Connected by a sound-wave line.
- Echoes the bidirectional matching mechanism.

#### CTA Zone (~240px)

- Primary button: "Generate My Clone"
  - Background: primary-color gradient
  - Text: white, 18px, bold
  - Radius: 999px (pill)
  - Shadow: primary color 20% opacity, Y 8px
- Secondary button: "Share with Friends"
  - Outlined, text in primary color.
- QR code bottom-right with slogan: "Discover your Echo Elf"

### 5.4 Responsive & Export

- In-app display is 9:16.
- Two export actions: "Save to Album" and "Share Directly."
- Exported image: PNG, 1080 × 1920, ≤ 800KB.

---

## 6. Sharing & Viral Mechanics

### 6.1 Share Paths

| Path | Experience |
|------|------------|
| **Poster share** | User saves image and shares to Moments / Xiaohongshu / Weibo. |
| **Link share** | Short referral link with invite code opens a landing page. |
| **Mini-program card** | Future: generate a card using the elf illustration. |

### 6.2 Landing Page (Recipient View)

Recipients see:

1. A preview of the friend's elf.
2. Copy: "Want to know your own Echo Elf? Take 6 minutes to find out."
3. Entry into the simplified Phase 1 onboarding flow.
4. Their own poster after completion, triggering second-degree sharing.

### 6.3 Referral Incentive (Optional)

- Sharing unlocks "Echo Coins" or extra elf skins.
- Keep gamification light to preserve the warm tone.

---

## 7. Technical Implementation Notes

### 7.1 Data Dependencies

| Data | Source | Use |
|------|--------|-----|
| `dimensionScores` | `services/api/src/onboarding/dimension-scorer.ts` | Archetype mapping, radar chart |
| `attachmentStyle` | Same as above | Keyword generation |
| `timePerspective` | Same as above | Keyword generation |
| `personaSketch` | Phase 1.5 | Declaration copy, free-text keywords |
| `idealPartnerSketch` | Phase 1.6 | Ideal-partner keywords |
| `identity.genderIdentity` | Phase 0 | Optional illustration tuning |
| `toneTags` | M2 language fingerprint | Personal keywords |

### 7.2 Recommended New Endpoint

```typescript
// GET /onboarding/poster
interface OnboardingPosterResponse {
  elfId: string;              // ELF-01
  elfName: string;            // Glow Deer
  colorPrimary: string;       // #FF6B6B
  colorSecondary: string;     // complementary color
  illustrationPrompt: string; // prompt for AI image generation
  declaration: string;        // elf declaration
  personalKeywords: string[];
  idealKeywords: string[];
  confidence: number;         // archetype mapping confidence
  secondaryElfId?: string;    // secondary archetype if low confidence
  radarData: { label: string; value: number; }[];
}
```

### 7.3 Illustration Strategy

**Option A: Pre-built library (recommended for Phase 1)**
- 12 high-quality illustrations (PNG/SVG), one per archetype.
- Fast loading, consistent style, low cost.
- New archetypes require new artwork.

**Option B: AI-generated in real time**
- Generate from `illustrationPrompt` via backend or MCP image tool.
- Highly personalized; harder to keep style consistent.

**Recommendation**: Phase 1 uses Option A with pre-built art + dynamic backgrounds based on the primary color. Option B can be a premium or later phase feature.

### 7.4 Frontend Component Structure

```tsx
// Echo/src/features/onboarding/PosterPage/
PosterPage.tsx
ElfResultCard.tsx          // Elf image + name + declaration
KeywordCloud.tsx           // Keyword pills
IdealRadar.tsx             // Radar chart or dual-elf visualization
ShareActions.tsx           // Save / Share buttons
usePosterData.ts           // Fetch poster data
elfLibrary.ts              // 12 archetype configs
```

---

## 8. Iteration & Testing Plan

### 8.1 Phase 1: MVP Poster

- 12 archetypes + keyword clouds + basic poster UI.
- Pre-built illustrations.
- PNG export.

### 8.2 Phase 2: Dynamic Enhancement

- Persona Sketch-aware declaration copy.
- Radar chart or dual-elf visualization.
- A/B test CTA copy.

### 8.3 Phase 3: Viral Growth

- Referral landing page.
- Share incentives.
- Platform-specific poster ratios (e.g., 3:4 for Xiaohongshu).

### 8.4 Metrics

- Poster save rate
- Share rate
- Landing-page conversion (poster → new onboarding)
- User resonance: "this is me" score (survey or NPS)

---

## 9. Appendix: Archetype & Keyword Cheat Sheet

| Archetype | Personal Keywords | Ideal-Partner Keywords |
|-----------|-------------------|------------------------|
| Glow Deer | Warm, listening, stable, present, sincere | Safety, companionship, responsiveness, gentleness |
| Star Fox | Curious, exploring, future, extraverted, open | Adventurous, deep talk, independent |
| Jade Rabbit | Calm, reliable, deep, introverted, stable | Quiet, understanding, stable, non-intrusive |
| Neon Fish | Vivid, spontaneous, expressive, extraverted, playful | Fun, light, non-serious, present |
| Watch Bear | Responsible, protective, long-term, reliable, warm | Responsibility, stability, long-term, sincerity |
| Dusk Butterfly | Delicate, nostalgic, creative, sensitive, open | Empathy, patience, artistry, gentleness |
| Firefly Cat | Playful, present, light, extraverted, playful | Easy, humorous, light, free |
| Listening Whale | Deep-feeling, sensitive, resonant, empathetic, attached | Responsiveness, safety, depth, patience |
| Wind Bird | Free, independent, boundaried, open, introverted | Space, independence, respect, ease |
| Guiding Eagle | Goal-driven, guiding, responsible, reliable, future | Growth, goals, stability, support |
| Moss Turtle | Slow to warm, safety-seeking, self, sensitive, stable | Patience, space, stability, gentleness |
| Cocoon Spirit | Vulnerable, profound, transforming, complex, creative | Patience, gentleness, safety, depth |

---

> This document is a proposal for the Phase 1 onboarding poster / shareable result page. Next steps: align with product, design, and algorithm teams on archetype mapping weights and illustration style, then move to frontend implementation.
