# Echo — Background Music Strategy & Brand Sonic Identity

| Field | Value |
|-------|-------|
| **Document version** | 1.0.0 |
| **Status** | Draft |
| **Last updated** | 2026-07-03 |
| **Author** | Whimsy Injector (Delightful Experience Designer) |
| **Audience** | Product, Design, Engineering |
| **Related docs** | [Delightful Experience Design](./Echo-Delightful-Experience-Design.md), [PRD](./PRD-Echo.md), [Brand Design Reference](./Echo-Brand-Design-Reference.md) |

---

## 1. Music Philosophy: Don't Compete for Attention, Resonate with Trust

### 1.1 Core Principle

Echo's background music must follow the core philosophy established in the Delightful Experience Design document — **"don't compete for attention, compete for trust."** Music here is not entertainment; it is **emotional architecture**:

> **The better the music, the less the user notices it playing.** It should exist like air — imperceptible when present, conspicuous when absent.

### 1.2 Three Laws of Music

| Law | Description | Consequence of violation |
|-----|-------------|--------------------------|
| **Don't steal the show** | Music volume is always below the user's inner monologue | Users feel annoyed, want to turn it off |
| **Have temperature** | Every track must convey a clear emotion, not just "sound nice" | Becomes elevator music, no brand recognition |
| **Breathe** | Music has dynamics, silence, and breathing space, not mechanical loops | Sounds like muzak after a while, loses presence |

### 1.3 Relationship to the Anticipation Loop

Music is not a standalone feature; it is the **emotional base layer** of the Anticipation Loop:

```
Clone auto-exploration (background, silence or minimal pad)
  →  Trust Dashboard (warm breathing tempo, 60 BPM)
    →  Anticipation Push (music micro-shifts when push arrives)
      →  Human Handoff (music reaches emotional peak, Handoff theme)
```

---

## 2. Echo Musical Brand Identity (Musical DNA)

### 2.1 Signature Motif: The Echo Motif

Just as Netflix has its "ta-dum" and T-Mobile has its jingle, Echo needs a **signature musical motif** — a 1.5-second sound that appears throughout the app's lifecycle in different arrangements.

**Echo Motif Design**:

```
Note sequence:  C5 → G4 → C5 (up → fall → return)
Duration:       ♩   ♩   ♩ (0.5s each, 1.5s total)
Meaning:        Sound goes out → travels → echo returns
```

- **C5 → G4**: A sound "goes out" (inversion of an ascending fifth)
- **G4 → C5**: The echo "comes back" (return to origin)
- This three-note motif appears in all stages in different arrangements, tempos, and timbres

**Appearance contexts**:

| Context | Arrangement | Timbre | Effect |
|---------|------------|--------|--------|
| App launch | Piano solo with reverb | Piano | "Echo awakens" |
| Onboarding complete | String ensemble, warm | Strings | "Your echo has taken shape" |
| Tab switch | Ultra-light electronic, 0.3s | Synth | Brand consistency without interruption |
| Handoff triggered | Full orchestral, crescendo | Full orchestra | "Echo found its resonance" |
| Push notification | Two-note version | Digital bell | Brand recognition — instantly identifiable as Echo |

### 2.2 Core Timbre Library (Echo Palette)

All stage music shares the following timbral DNA to ensure brand consistency:

| Timbre category | Specific instruments | Brand meaning | Usage |
|----------------|---------------------|---------------|-------|
| **Warm base** | Soft synth pad | "The clone's digital presence" | Underlying layer in all stages |
| **Human warmth** | Piano (especially mid-low register) | "The real person" | Emotional moments, introspective times |
| **Echo imagery** | Distant instruments with heavy reverb | "Sound traveling and returning" | Transitions, scene changes |
| **Social pulse** | Light percussion (shaker, claves, woodblock) | "Two people in conversation" | Matching, roleplay |
| **Dreamy texture** | Harp, glockenspiel | "Imagination and possibility" | Ideal partner sketch |
| **Birth of life** | String crescendo | "Clone awakening" | Finalize, Handoff |

### 2.3 Key Strategy

| Key | Emotional color | Usage stages |
|-----|----------------|-------------|
| **C major** | Warm, innocent, safe | Splash, Clone birth, Handoff acceptance |
| **F major** | Tender, lyrical, introspective | Identity cards, Persona sketch |
| **D minor** | Nostalgic, deep, nocturnal | Activity log, Late night mode |
| **G major** | Bright, curious, exploratory | Scenario cards, Match list |
| **A mixolydian** | Mysterious, dreamy, imaginative | Ideal partner sketch |
| **E-flat major** | Warm, rounded, enveloping | Clone dashboard, Daily browsing |

---

## 3. Per-Stage Music Strategy

### 3.1 Act 1 — Awakening

#### Splash Screen

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Ethereal ambient + single-note piano |
| **BPM** | 50-60 |
| **Primary instruments** | Piano + soft synth pad |
| **Volume** | 15-20% (very low) |
| **Duration** | 15-30 seconds, natural fade-in |
| **Core characteristic** | A single piano C note slowly emerges, synth pad rises from underneath, then the Echo Motif (C→G→C) softly appears |
| **Emotional goal** | "A sound is awakening in an empty space" — echoing Echo's brand metaphor |
| **Fade-out** | Natural 1-second fade as user navigates away |

**AI generation prompt**:
> Ambient cinematic intro, single piano note (C5) slowly fading in with heavy reverb, ethereal synth pad emerging from underneath, very slow attack, 50-60 BPM, minimal, no percussion, evokes the feeling of a sound beginning to echo in an empty vast space, warm and awakening, 30 seconds, ends with a soft three-note motif (C-G-C) on piano

---

#### Authentication (Login / Register)

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Minimal + warm marimba |
| **BPM** | 70-80 |
| **Primary instruments** | Marimba + soft acoustic guitar |
| **Volume** | 10-15% (background underlay, barely perceptible) |
| **Core characteristic** | Sparse marimba arpeggios, clean, reliable, non-distracting. Users should not be interrupted while entering phone numbers and OTP codes |
| **Emotional goal** | "A safe entrance" — like a quiet morning, reassuring as you complete necessary steps |
| **Special design** | When OTP is correct, the Echo Motif plays softly on marimba (C→G→C) as auditory feedback for "verification passed" |

**AI generation prompt**:
> Minimal warm ambient, soft marimba arpeggios in F major, sparse acoustic guitar fingerpicking, clean and simple, no drums, 70-80 BPM, background utility music, trustworthy and calm, like a quiet morning, 60 seconds loop, very low intensity, should not distract from form filling

---

### 3.2 Act 2 — Self-Discovery

#### Phase 0: Identity Cards

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Warm lo-fi + piano arpeggios |
| **BPM** | 72-80 |
| **Primary instruments** | Lo-fi piano + warm synth + light vinyl crackle |
| **Volume** | 20-25% |
| **Core characteristic** | Lo-fi warmth creates a "journal-writing" sense of privacy. Light vinyl noise adds authenticity and intimacy. No prominent drum beats — maintain introspective atmosphere |
| **Emotional goal** | "I'm thinking about who I really am" — like sitting by a window writing in a journal, warm, safe, private |
| **Dynamic design** | As 12 fields appear one by one, each card flip brings a subtle harmony shift (like a page-turn sound) while maintaining the same base |

**AI generation prompt**:
> Warm lo-fi hip-hop, soft piano arpeggios in F major, gentle vinyl crackle, warm bass, no harsh drums, 72-80 BPM, introspective and personal, like writing in a journal by a window with soft afternoon light, cozy and reflective, 2 minute loop, should feel intimate and safe

---

#### Phase 1: Scenario Cards

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Warm electronic + light percussion |
| **BPM** | 85-95 |
| **Primary instruments** | Warm synth + light percussion (shaker, claves) + bass |
| **Volume** | 25-30% |
| **Core characteristic** | More rhythm than Phase 0, light percussion brings a "browsing choices" momentum. Still primarily warm, not anxious |
| **Emotional goal** | "Interesting, let me think about what to choose" — curious, exploratory, rhythmic decision-making |
| **Dynamic design** | 18 cards split into 3 groups (6 each); each group subtly shifts (key change or new instrument added) to form a narrative arc |
| **Persona fragment checkpoint** | Every 5 cards, a soft string shimmer appears for 2 seconds at the checkpoint display |

**AI generation prompt**:
> Warm electronic, gentle synth melodies in G major, light hand percussion (shaker, claves), subtle bass groove, 85-95 BPM, curious and exploratory, no heavy beats, feels like browsing through interesting possibilities with curiosity, 2 minute loop, warm and inviting

---

#### Phase 1.5: Persona Sketch

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Cinematic + string crescendo |
| **BPM** | 60-70 (free tempo) |
| **Primary instruments** | String quartet + piano + soft electronic |
| **Volume** | 30-40% |
| **Core characteristic** | This is the **emotional climax** of onboarding — the user sees AI's depiction of their personality for the first time. Music should feel like the cinematic moment when a protagonist "sees themselves" |
| **Emotional goal** | "Is this me? …It really is me." — wonder, self-discovery, the emotion of being truly seen |
| **Dynamic design** | As the page loads (AI generating), music starts from silence. As each of the 8 sections appears, strings gradually join. When all 8 are shown, music reaches a warm major chord |
| **User edit feedback** | When user edits a sentence, a soft "confirmation" sound plays (Echo Motif variant), signaling "updated" |

**AI generation prompt**:
> Cinematic emotional, string quartet building slowly from soft to warm, piano providing harmonic foundation in F major, subtle electronic textures, 60-70 BPM, sense of wonder and self-discovery, like unwrapping a gift that reveals yourself, 90 seconds, starts minimal builds to a warm resolution, should evoke the feeling of being truly seen and understood

---

#### Phase 1.6: Ideal Partner Sketch

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Dreamy ambient + harp |
| **BPM** | 60-68 |
| **Primary instruments** | Harp + soft synth pad + glockenspiel |
| **Volume** | 25-30% |
| **Core characteristic** | Harp plucks like "imagined starlight," glockenspiel adds dreaminess. Should not be overly sweet — maintain "imagining something wonderful" rather than "confirmed happiness" |
| **Emotional goal** | "If only someone like this existed…" — longing, warm, unhurried |
| **Dynamic design** | 4 dimension bars can have subtle timbre shifts (Emotional Safety → warm pad; Space Respect → airy spaciousness; Direct Communication → clear timbre; Conflict Resolution → harmonic resolution feel) |

**AI generation prompt**:
> Dreamy romantic ambient, harp arpeggios in A mixolydian, soft synth pads, gentle glockenspiel, no percussion, 60-68 BPM, hopeful and warm without being cheesy, feels like imagining someone wonderful, ethereal and tender, 90 seconds loop, should evoke longing and hopefulness

---

#### Phase 2: Roleplay Chat

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Chill lo-fi beat + Rhodes electric piano |
| **BPM** | 80-90 |
| **Primary instruments** | Rhodes electric piano + lo-fi drums + warm bass |
| **Volume** | 25-30% |
| **Core characteristic** | Simulates "chatting with a friend at a cafe" ease. Drums should not be too heavy — leave breathing room for conversation |
| **Emotional goal** | "Just chatting, it's comfortable" — relaxed, natural, like real socializing |
| **Dynamic design** | 4 AI characters can have different micro-variations |

**Character music micro-adjustments**:

| Character | Timbre adjustment | Emotional difference |
|-----------|------------------|---------------------|
| Best friend | Standard lo-fi beat | Casual, easygoing |
| Crush | Add soft vibraphone, 2 BPM slower | Subtle heartbeat feeling |
| Interesting stranger | Add lively synth melody | Curious, fresh |
| Old friend | Add acoustic guitar | Nostalgic, warm |

**AI generation prompt (base)**:
> Chill lo-fi beat, Rhodes electric piano melody in C major, soft boom-bap drums, warm bass line, 80-90 BPM, conversational and comfortable, like chatting in a cozy cafe, relaxed and friendly, 3 minute loop, no vocals, should leave space for thinking and typing

---

#### Finalize: Clone Birth

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Orchestral + electronic hybrid · crescendo |
| **BPM** | 60 → 90 accelerating |
| **Primary instruments** | Strings + piano + electronic synth + timpani |
| **Volume** | 35-45% |
| **Core characteristic** | This is the **climax** of onboarding — the clone is being created. Music starts from minimal piano, gradually adds strings, electronic textures, timpani, and bursts into a warm major chord before settling back to quiet |
| **Emotional goal** | "Something new is being born" — transformation, sacredness, anticipation |
| **Dynamic design** | Rotating loading text changes every 8 seconds; music layers sync accordingly |

**Music layer timeline**:

| Time | Loading text | Music layer |
|------|-------------|-------------|
| 0-8s | "Building your digital echo…" | Solo piano, C minor |
| 8-16s | "Generating four-layer personality model…" | Strings join, shift to C major |
| 16-24s | "Writing style fingerprint…" | Electronic synth joins |
| 24-32s | "Preparing first social exploration…" | Timpani joins, crescendo |
| 32-40s | "Clone is ready" | Full orchestral burst, complete Echo Motif |
| 40s+ | "Enter the plaza" button appears | Chord sustains, gradually settles |

**AI generation prompt**:
> Cinematic orchestral-electronic hybrid, starts minimal with solo piano in C minor, gradually adds string section transitioning to C major, electronic synth textures, building timpani, crescendo to a triumphant warm major chord resolution, 60 to 90 BPM, feels like a digital being coming to life, magical and transformative, 45 seconds, the climax should feel like a birth announcement, followed by a gentle resolution

---

### 3.3 Act 3 — Daily Life

#### Feed / Plaza

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Ambient lo-fi · very low volume |
| **BPM** | 75-85 |
| **Primary instruments** | Lo-fi piano + synth pad + light drums |
| **Volume** | 15-20% (low background) |
| **Core characteristic** | Very low energy background music for focused reading. No "hook" melodies |
| **Emotional goal** | "Just scrolling, seeing what's interesting" — relaxed, pressure-free browsing |
| **Dynamic design** | Pull-to-refresh triggers the sound wave ripple visual; simultaneously, a 2-second "ripple" audio effect overlays (the wave version of the Echo Motif) |

**AI generation prompt**:
> Ambient lo-fi, very low energy, soft piano phrases in E-flat major, gentle synth pad, minimal boom-bap drums, 75-85 BPM, background browsing music, should not distract from reading, warm and casual, 3 minute loop, instrumental only, no hooks or prominent melodies

---

#### Match List

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Warm electronic + subtle pulse |
| **BPM** | 82-92 |
| **Primary instruments** | Synth + light pulse bass + micro-percussion |
| **Volume** | 20-25% |
| **Core characteristic** | Slightly higher energy than Feed, with a subtle "pulse" suggesting something good is happening. But absolutely no anxiety or urgency |
| **Emotional goal** | "Seems like someone's hitting it off with my clone" — curious, mildly expectant |
| **Dynamic design** | Affinity temperature bar color changes can sync with music micro-adjustments: cold blue match → minor key; warm orange → major key; heartbeat red → strings join |

**AI generation prompt**:
> Warm electronic, gentle synth melody in G major with subtle pulse, light bass groove, minimal percussion, 82-92 BPM, curious and hopeful without anxiety, feels like something good might happen, not urgent, 2 minute loop, warm and anticipatory

---

#### Clone Dashboard

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Soft pad · breathing tempo |
| **BPM** | 60 (breathing rate) |
| **Primary instruments** | Soft synth pad + distant piano echoes |
| **Volume** | 15-20% |
| **Core characteristic** | Music tempo precisely matches breathing frequency (4-second breath cycle = 60 BPM), synced with the clone's breathing green dot animation. Conveys "all is well" reassurance |
| **Emotional goal** | "The clone is alive, healthy, I can relax" — peace, trust, relaxation |
| **Dynamic design** | Clone active: breathing-tempo pad; Clone paused: music stops, only a sustained ultra-low drone (suggesting "sleeping") |

**AI generation prompt**:
> Calm ambient pad, very slow breathing tempo at 60 BPM, soft sustained synth chords in E-flat major, distant piano echoes with heavy reverb, no percussion, peaceful and reassuring, feels like watching something alive and healthy breathing, 2 minute loop, zen and trustworthy, should make the listener feel at ease

---

#### Activity Log

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Warm acoustic · retrospective |
| **BPM** | 72-80 |
| **Primary instruments** | Acoustic guitar + piano + light strings |
| **Volume** | 20-25% |
| **Core characteristic** | Fingerpicked guitar brings a "reading a diary" texture; piano and light strings add warmth |
| **Emotional goal** | "What interesting things happened today?" — warm, curious, reflective |
| **Dynamic design** | Tapping a session to view transcript → music fades to quieter version, making room for dialogue content |

**AI generation prompt**:
> Warm acoustic, fingerpicked guitar in D minor, gentle piano, light string pad, 72-80 BPM, nostalgic and curious, like reading a diary of good things that happened today, warm and reflective, 2 minute loop, should feel like a cozy evening looking back at the day

---

#### Settings

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Silence or minimal underlay |
| **BPM** | — |
| **Primary instruments** | Minimal single note or silence |
| **Volume** | 0-5% |
| **Core characteristic** | Settings is a functional page; no emotional rendering needed. Can be completely silent or maintain a single ultra-low synth drone for environmental consistency |
| **Emotional goal** | "I'm adjusting some things" — neutral, functional, non-intrusive |
| **Special design** | Add "Background Music" toggle + volume slider in settings for user control |

---

### 3.4 Act 4 — The Climax

#### Handoff Ceremony

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Full orchestral · emotional peak |
| **BPM** | 70 → 60 settling |
| **Primary instruments** | Full strings + piano + woodwinds + light percussion |
| **Volume** | 40-50% (highest in the app) |
| **Core characteristic** | This is Echo's **highest-value moment** — the critical point from AI agency to human decision. Music should be the richest arrangement in the entire app, and the only scene where volume above 40% is permitted |
| **Emotional goal** | "This moment is worth showing up for in person" — emotion, connection, ceremony |

**Handoff complete music timeline**:

| Phase | Duration | Music description |
|-------|----------|------------------|
| Push arrives | — | Notification sound = Echo Motif two-note version (G→C), warm, not jarring |
| Open Handoff page | 0-5s | Strings slowly emerge from silence; piano plays Echo Motif (C→G→C) |
| Show match reasons | 5-15s | Strings sustain warm bed; woodwind solo (oboe/english horn) joins |
| Show conversation highlights | 15-25s | Music slightly recedes to make room for dialogue; pad continues underneath |
| Accept button pulse | Continuous | Button pulse animation syncs with musical pulse (subtle accent every 2 seconds) |
| Click "Want to meet" | 0-5s | Full orchestral burst! Strings + piano + light timpani, Echo Motif in fullest arrangement |
| Celebration animation | 5-15s | Warm orange + soft purple particles fall; music gradually settles from peak to warm sustained chord |
| Waiting for response | Continuous | Returns to soft pad but with an added string layer, suggesting "something is brewing" |

**AI generation prompt**:
> Emotional cinematic orchestral, full strings with warm cello, solo piano, woodwind accents (oboe, english horn), subtle timpani, 70 to 60 BPM, starts with a three-note motif (C-G-C) on solo piano, builds through string sections, reaches emotional peak with full orchestra, then resolves to a warm intimate chord, feels like two souls connecting, the most important moment in the app, 60 seconds, should bring tears of joy, C major resolution

---

#### Error / Empty States

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Soft · dissonance → consonance resolution |
| **BPM** | Free tempo |
| **Primary instruments** | Piano + synth · descending resolution |
| **Volume** | 15-20% |
| **Core characteristic** | Errors should not have an "alarm" feel. Music should be like a gentle "it's okay" — starting from a soft suspended chord, resolving to a warm major chord within 1-2 seconds |
| **Emotional goal** | "Signal got lost. Try again?" — soothing, gentle, non-anxious |

**Error music variants**:

| Error type | Music treatment |
|-----------|----------------|
| Network error | Piano resolves from suspended chord to major, 3 seconds, like a sigh then a smile |
| Load timeout | Ultra-soft descending scale, 2 seconds, then returns to normal background |
| Empty state (no matches) | Not error music but a specially gentle pad version, suggesting "good things take time" |

**AI generation prompt**:
> Gentle resolving piano, starts with a soft suspended chord (Gsus4), resolves to warm C major, very short phrase 5-8 seconds, feels like a kind musical shrug, no percussion, reassuring and non-dramatic, should make the user feel it is okay and they can try again, warm and forgiving

---

#### Late Night Mode

| Dimension | Recommendation |
|-----------|---------------|
| **Music style** | Stellar ambient · ethereal |
| **BPM** | 50-55 |
| **Primary instruments** | Ethereal synth + distant piano + subtle twinkling textures |
| **Volume** | 10-15% |
| **Core characteristic** | Automatically switches at 0:00-6:00 (synced with the "Late Night Mode" in the Delightful Experience Design). Music becomes more spacious, sparser, like stargazing alone |
| **Emotional goal** | "It's late, only my clone and I are still awake" — tranquility, solitude, but not loneliness |
| **Dynamic design** | All stage music gets a "stellar variant" at night — percussion removed, ethereal high frequencies added, BPM reduced 10-15%, volume lowered |

**AI generation prompt**:
> Stellar ambient, ethereal synth pads, distant piano notes with heavy reverb, subtle twinkling high-frequency textures like distant stars, 50-55 BPM, very sparse, feels like looking at stars alone at night, peaceful and solitary but not lonely, 3 minute loop, no drums, should feel like a private moment with the universe

---

## 4. Echo Music Signature: 5 Unique Designs

### 4.1 Echo Motif Throughline System

**Concept**: A 1.5-second three-note motif (C→G→C) appears across all 16 stages in 16 different arrangements.

**Implementation**:
- When generating with AI, uniformly add `include a three-note motif (C5-G4-C5) as a recurring melodic cell` to prompts
- Each stage arranges it differently: piano, marimba, strings, harp, full orchestral…
- Users subconsciously form brand auditory memory, like Intel's "bong" or NBA's snippet

**Variant list**:

| Stage | Echo Motif arrangement | Timbre | Trigger |
|-------|----------------------|--------|---------|
| Splash | Piano solo with reverb | Piano | End of splash animation |
| OTP verified | Marimba, light | Marimba | When OTP is correct |
| Phase 0 complete | Lo-fi piano | Piano + vinyl | 3D card flip |
| Phase 1 checkpoint | Synth | Warm synth | Every 5 cards |
| Phase 1.5 complete | String ensemble | String quartet | All 8 sections shown |
| Phase 1.6 complete | Harp | Harp + glockenspiel | Dimension adjustment submitted |
| Phase 2 complete | Rhodes | Electric piano | Conversation ends, style extracted |
| Finalize | Full orchestral | Full orchestra | Clone birth climax |
| Tab switch | Ultra-light electronic | Synth | Each bottom tab switch |
| Handoff | Full orchestral, peak | Full orchestra | Accept button pressed |
| Push notification | Two-note version | Digital bell | Notification arrives |

### 4.2 Clone Music Fingerprint

**Concept**: Each user's clone has a unique "musical fingerprint" — a 15-second musical signature generated from their personality data.

**Data sources**:
- Key personality dimensions from onboarding (warmth, openness, energy level, etc.)
- User's tone tags (gentle/direct/humorous/quiet, etc.)
- User's hobbies (influencing instrument preferences)

**Generation method**:
1. Map personality dimensions to musical parameters:
   - Warmth → major/minor key selection
   - Energy level → BPM range
   - Openness → harmonic complexity
   - Tone tags → primary instrument selection
2. Generate clone theme with AI music tools
3. Play on the "My Clone" page (user first hears it as a "clone music card" after onboarding)

**Example mapping**:

| Personality trait | Music parameter | Effect |
|------------------|----------------|--------|
| High warmth + low energy | C major, 65 BPM, piano + pad | Gentle, quiet, reliable |
| High openness + high energy | G major, 90 BPM, synth + light percussion | Curious, lively, fun |
| High directness + medium energy | D mixolydian, 80 BPM, Rhodes + bass | Direct, distinctive |
| High humor + low warmth | F major, 75 BPM, marimba + glockenspiel | Light, fun, not heavy |

**AI generation prompt template**:
> Generate a 15-second personal musical signature based on these personality traits: [warmth: X/10, energy: Y/10, openness: Z/10, directness: W/10]. Key: [derived key], BPM: [derived BPM], primary instrument: [derived instrument]. The piece should feel like a musical portrait of a person — their essence distilled into sound. Include the three-note echo motif (C-G-C) as a hidden element. No vocals. Should be loopable and pleasant on repeat.

### 4.3 Affinity Music Thermometer

**Concept**: Match detail page music arrangement dynamically changes based on affinity score, letting users "feel" relationship temperature through sound.

**Temperature zones**:

| Affinity range | Music arrangement | Emotional temperature |
|--------------|------------------|----------------------|
| 0-30% | Minor key pad, spacious, distant | "Just met, still exploring" |
| 30-50% | Light rhythm joins, neutral key | "Chatting okay, somewhat interesting" |
| 50-70% | Shift to major, strings join | "Going well, sparks flying" |
| 70-85% | Warm major, woodwind solo | "Great fit, worth anticipating" |
| 85%+ | Approaching Handoff arrangement, string crescendo | "Something wonderful is near…" |

**Technical implementation**:
- Pre-generate 5 temperature zone music segments
- On affinity change, crossfade to corresponding zone within 2 seconds
- Or use layered audio: pad layer always plays; add rhythm, string, woodwind layers based on affinity

### 4.4 Time-Aware Arrangement System

**Concept**: The same music has different arrangement versions at different times of day, making the app feel "alive in time."

| Time block | Arrangement change | Mood |
|-----------|-------------------|------|
| 6:00-10:00 (morning) | Brighter, add glockenspiel/xylophone, BPM +5 | "A new day begins" |
| 10:00-14:00 (midday) | Standard version | Normal energy |
| 14:00-18:00 (afternoon) | Slightly warmer, add acoustic elements | "Steady afternoon" |
| 18:00-22:00 (evening) | Softer, BPM -5, add Rhodes electric piano | "Relaxing evening" |
| 22:00-0:00 (pre-night) | Quieter, remove percussion | "Getting late" |
| 0:00-6:00 (late night) | Stellar ambient version, minimal | "Stargazing time" |

**Implementation**:
- Generate 3 versions per track: Day / Evening / Night
- Auto-switch based on `new Date().getHours()`
- 3-second crossfade on switch

### 4.5 Waveform Sync (Audio-Visual Linkage)

**Concept**: Echo's visual design already has "sound wave ripple" animation elements (see Delightful Experience Design §9.2). Real-time frequency spectrum of background music can drive these visual effects.

**Linkage scenarios**:

| Visual element | Music linkage method |
|---------------|---------------------|
| Clone breathing green dot | Breathing cycle synced to music BPM |
| Pull-to-refresh ripple | Ripple spread speed synced to music volume peaks |
| Handoff celebration particles | Particle fall rhythm synced to music beats |
| Affinity temperature bar | Temperature bar pulse synced to music low frequencies |
| Push notification expand | Expand animation synced to Echo Motif |

**Technical implementation**:
- Use Web Audio API `AnalyserNode` for real-time frequency data
- Map frequency data to CSS variables or SVG animation parameters
- Performance optimization: only enable on key visual elements, avoid global spectrum analysis

---

## 5. AI Music Customization Workflow

### 5.1 Recommended Tools

| Tool | Best for | Advantage |
|------|---------|-----------|
| **Suno AI** | Full track generation | Fast, diverse styles, commercial license |
| **Udio** | High-quality music generation | Better audio quality, more controllable |
| **MusicGen (Meta)** | Open-source, local deployment | Fully controllable, no copyright risk, fine-tunable |
| **ElevenLabs Music** | Sound effects and short motifs | Good for Echo Motif, notification sounds |
| **AIVA** | Orchestral/cinematic scoring | Excels at Finalize and Handoff complex arrangements |

### 5.2 Generation Workflow

```
Step 1: Generate Echo Motif base version (1.5s core motif)
    ↓
Step 2: Based on base version, generate full background music for each stage
    ↓
Step 3: Generate personalized variants for clone music fingerprints
    ↓
Step 4: Generate time-aware variants (Day / Evening / Night × 16 stages)
    ↓
Step 5: Generate affinity temperature variants (5 zones × match page)
    ↓
Step 6: Human review + fine-tuning (ensure brand consistency, no copyright issues)
    ↓
Step 7: Audio post-processing (normalization, loop optimization, compression)
    ↓
Step 8: Integrate into application
```

### 5.3 AI Prompt Writing Principles

1. **Always specify BPM**: Let AI precisely control tempo
2. **Always specify key**: Ensure brand tonal consistency
3. **Always specify instruments**: Keep timbre within Echo Palette
4. **Always include emotional description**: Let AI understand "why" not just "what"
5. **Always specify duration and looping**: Background music needs seamless loops
6. **Always include "no vocals"**: Unless special need, instrumental only
7. **Always include Echo Motif requirement**: Add `include a three-note motif (C5-G4-C5) as a subtle recurring element` at end of prompt

### 5.4 Audio Technical Specs

| Spec | Value | Reason |
|------|-------|--------|
| Format | AAC (m4a) | Best mobile compatibility, small size |
| Alt format | OGG Vorbis | Web preferred, smaller size |
| Sample rate | 44.1 kHz | Standard CD quality |
| Bitrate | 128 kbps (background) | Background doesn't need lossless |
| Bitrate | 192 kbps (Handoff/Finalize) | Climax moments need better quality |
| Looping | Seamless | 3-second crossfade processing |
| File size target | < 500 KB per track | Mobile loading performance |
| Total tracks | ~25-30 | 16 stages + variants |

---

## 6. Technical Implementation

### 6.1 Audio Architecture

```
EchoAudioManager (singleton)
  ├── currentTrack: currently playing audio
  ├── trackMap: stage → audio file mapping
  ├── transition(): crossfade on stage switch
  ├── setVolume(): global volume control
  ├── setTimeVariant(): time-aware variant switching
  └── analyser: Web Audio API spectrum analyzer (for waveform sync)
```

### 6.2 Web Implementation

```typescript
class EchoAudioManager {
  private audio: HTMLAudioElement;
  private gainNode: GainNode;
  private analyser: AnalyserNode;
  private audioContext: AudioContext;
  private currentStage: string;
  private volume: number = 0.2;

  private trackMap: Record<string, {
    day: string; evening: string; night: string;
  }> = {
    'splash': { day: '/audio/splash-day.m4a', ... },
    'onboarding-p0': { day: '/audio/p0-day.m4a', ... },
    // ...
  };

  transitionToStage(stage: string, crossfadeDuration = 2000) {
    // 1. Select day/evening/night variant based on current time
    // 2. Create new audio element
    // 3. Crossfade
    // 4. Update analyser connection
  }

  getFrequencyData(): Uint8Array {
    return this.analyser.getByteFrequencyData(...);
  }
}
```

### 6.3 Android Implementation

```kotlin
class EchoAudioManager(private val context: Context) {
    private var mediaPlayer: MediaPlayer? = null
    private var currentStage: String = ""

    fun transitionToStage(stage: String, crossfadeMs: Long = 2000) {
        val timeVariant = getTimeVariant()
        val audioResId = getAudioResource(stage, timeVariant)
        // Use two MediaPlayers for crossfade
    }

    private fun getTimeVariant(): String {
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return when {
            hour in 6..17 -> "day"
            hour in 18..23 -> "evening"
            else -> "night"
        }
    }
}
```

### 6.4 User Controls

Add a "Music Preferences" section in Settings:

| Setting | Default | Description |
|---------|---------|-------------|
| Background music | On | Master toggle |
| Music volume | 20% | Global volume slider (0-50%) |
| Handoff music boost | On | Whether Handoff uses higher volume |
| Auto late-night switch | On | Auto-switch to stellar version 0-6 AM |
| Reduced motion | Follow system | When on, music skips time variants, uses standard version |

---

## 7. Accessibility & Inclusivity

### 7.1 Auditory Accessibility

| Requirement | Implementation |
|------------|---------------|
| Fully disablable | Can be completely turned off in settings |
| Default low volume | First launch defaults to 20%, not 50% |
| Doesn't mask screen readers | Music frequency band avoids vocal range (attenuate 200Hz-4kHz appropriately) |
| Vibration alternative | Key moments (Handoff, verification pass) provide haptic feedback alternative |
| Visual equivalent | When Echo Motif plays, visual ripple effect syncs simultaneously |

### 7.2 Cultural Sensitivity

| Requirement | Implementation |
|------------|---------------|
| Instrument selection | Avoid instruments with specific cultural/religious significance |
| Key selection | Avoid keys associated with funerals in certain cultures |
| Volume cultural differences | Different cultures have different background music tolerance; provide fine-grained control |
| No lyrics | All background music is purely instrumental, avoiding language and cultural bias |

---

## 8. Phased Implementation

### Phase 1 (MVP — with APK launch)

| Priority | Feature | Rationale |
|----------|---------|-----------|
| P0 | Echo Motif base version (1.5s motif) | Brand musical DNA |
| P0 | Splash screen music | First auditory impression |
| P0 | Finalize clone birth music | Onboarding climax |
| P0 | Handoff ceremony music | Product's highest-value moment |
| P0 | Music toggle + volume control in settings | User control |
| P1 | Phase 0-2 onboarding background music (1 per stage) | Onboarding experience completeness |
| P1 | Tab switch Echo Motif micro-sound | Brand consistency |
| P2 | Main app 5 tabs background music | Daily usage |

### Phase 2 (Retention iteration)

| Feature |
|---------|
| Clone Music Fingerprint generation and playback |
| Affinity Music Thermometer |
| Time-Aware Arrangement System |
| Waveform Sync |
| Push notification brand sound |

### Phase 3 (Long-term)

| Feature |
|---------|
| Late night mode music variants |
| Festival-themed music |
| Clone growth stage music evolution |
| User-customizable clone music style preferences |
| AI real-time personalized music (based on current mood/scene) |

---

## 9. Success Metrics (Music Dimension)

| Metric | Definition | Target |
|--------|-----------|--------|
| **Music retention rate** | Users who haven't disabled background music | ≥ 75% |
| **Handoff music completion rate** | Users who stay on Handoff page ≥ 15 seconds | ≥ 80% |
| **Brand music recognition** | Users who can identify Echo's musical motif in surveys | ≥ 40% |
| **Music satisfaction** | User satisfaction score for background music (1-5) | Avg ≥ 3.5 |
| **Music non-interference rate** | Users who agree "music doesn't interfere with my app usage" | ≥ 85% |

---

## Appendix A — Complete AI Prompt Collection

See the 16 stage prompts in section 3 above. Each prompt follows these principles:
- Always specifies BPM, key, and instruments
- Always includes emotional description
- Always specifies duration and loopability
- Always includes "no vocals"
- Always includes the three-note Echo Motif (C-G-C) as a recurring element

---

## Appendix B — Clone Music Fingerprint Mapping Table

| Personality dimension | Value range | Music parameter mapping |
|----------------------|------------|------------------------|
| Warmth | 0-10 | 0-4: minor; 5-7: mixed; 8-10: major |
| Energy | 0-10 | BPM = 60 + (energy × 4), range 60-100 |
| Openness | 0-10 | 0-3: simple harmony (I-IV-V); 4-7: moderate (add ii-vi); 8-10: complex (jazz harmony) |
| Directness | 0-10 | 0-3: pad/ambient; 4-7: piano/Rhodes; 8-10: percussion/rhythmic |
| Humor | 0-10 | 0-3: serious strings; 4-7: light marimba; 8-10: playful glockenspiel |
| Introvert/Extrovert | 0-10 | 0-3: solo instrument; 4-7: duo; 8-10: small ensemble |

---

## Appendix C — Glossary

| English | Chinese | Description |
|---------|---------|-------------|
| Echo Motif | 回声主题 | Echo's signature three-note motif (C→G→C) |
| Clone Music Fingerprint | 分身音乐指纹 | Personalized music signature generated from user personality |
| Affinity Music Thermometer | 好感度音乐温度计 | Music arrangement that changes based on match affinity |
| Time-Aware Arrangements | 时间感知编曲 | Music variants that switch based on time of day |
| Waveform Sync | 声波可视化联动 | Audio frequency spectrum driving visual effects |
| Echo Palette | Echo 核心音色库 | Shared brand timbre collection across all stages |

---

## Appendix D — Related Resources

- [Echo Delightful Experience Design](./Echo-Delightful-Experience-Design.md) — Brand personality, micro-interactions, microcopy
- [Echo PRD](./PRD-Echo.md) — Product requirements and feature definitions
- [Echo Brand Design Reference](./Echo-Brand-Design-Reference.md) — Logo, colors, mascot
- [Agent Behavior and Mechanics](./Agent-Behavior-and-Mechanics-Echo.md) — Clone runtime and behavior
