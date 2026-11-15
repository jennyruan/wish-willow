# Wish Willow — PRD

**YC Consumer Mobile Hackathon · Sun Nov 15 2026 · solo · Expo + Convex + Capy + Revyl (+ Supermemory)**
**Demo vertical: find connection.** Engine is vertical-agnostic; connection is the spine for today.

> *Make a wish. Something falls in love with helping you keep it.*

---

## ── FOR THE HUMAN (why) ──

### 1. Problem
People carry a wish they never get to — and every app waits for *them* to show up.

### 2. Why now
The bar YC set is "an app people open again tomorrow." Companions talk but don't act; coaches advise but don't do the legwork; assistants act but don't know you or reach out. **No incumbent combines proactive outreach + real-world legwork + wish-to-plan** — that white space is the opening, and voice + persona-memory (Jenny's edge) is what makes "it comes to you and it's *yours*" feel real.

### 3. Solution
A voice companion devotedly obsessed with helping you keep one wish: you speak it, Willow makes a plan and **comes to you every day with the next real step**, adapting as it learns you.

### 4. Reasoning
- **Proactive, not reactive** — Willow comes to you. Fresh framing in a room of 180 chatbots, and it *is* the "come back tomorrow" retention mechanic (not bolted on).
- **Earned attachment, not dark patterns** — dopamine from being genuinely known + visible progress (the willow grows), never streak-guilt or spam. Holds up at six months, which is the judges' real bar.
- **Two filters it passes** — fights loneliness (a patient daily presence); democratizes a luxury (a 1:1 concierge who remembers everything is what rich people pay for).
- **The flip (narrative hook)** — the 2025 movie *Obsession* has a "One Wish Willow" whose wish becomes a curse inflicted on someone else. Wish Willow is the good version: the wish is *yours*, consensual, and the obsession belongs to the *agent*, pointed at your growth.
- **Vision line (close on this)** — *"Today it helps you find your person. Tomorrow you wish for anything — get fit, learn CS, grow your startup — and Willow conspires to get you there."*

---

## ── SHARED (what) ──

### 5. UI structure
One memorable visual (the willow tree that grows) beats five screens. Four screens, voice-forward.

```
App
├─ WishScreen            "What do you wish for?"  [willow sapling]
│   └─ BlowToCast        mic-blow (or tap/hold) → catkin particle burst → wish cast
├─ IntakeScreen         Willow asks 1–3 Qs by voice (what kind of person / how soon)
│   └─ "Okay — I'm on it."
├─ DailyScreen          ← the core screen
│   ├─ WillowGreeting    warm line w/ name + 1 remembered detail (from Supermemory)
│   ├─ SuggestionCard    title · place · when · category   [Accept] [Decline]  (voice or tap)
│   ├─ AdaptBanner       "You skipped the bars, loved the outdoorsy stuff — leaning in."
│   └─ WillowTree        grows as suggestions are accepted/attended
└─ (fallback) progress bar replaces WillowTree if behind
```

### 6a. Product facts (stated once)
- **Type:** iOS consumer mobile app (Expo Go on phone for demo; EAS simulator build for Revyl).
- **Data model (Convex):**
  ```
  users        { _id, name, createdAt }
  wishes       { _id, userId, text, type, timeline, intake, createdAt, status }
  suggestions  { _id, wishId, title, place, when, category,
                 status: 'pending'|'accepted'|'declined', shownAt }
  events       { _id, userId, type, payload, ts }   // accept/decline signals, wins
  ```
  - Convex = reactive store; `useQuery` pushes live updates (the "it's alive" feel on stage).
  - **Supermemory** = the compounding profile (learned preferences, personal facts, wins) Willow references to feel devoted. Load-bearing — the "remembers you" magic lives here. (`namespace` = userId, v5; `sm_` key server-side only.)
- **Seed, don't integrate:** the 42 real SF spots in `sf-suggestions.seed.json` populate `suggestions`. On stage this looks identical to live search, with zero integration risk. One real web-search call is a bonus *only if way ahead*.
- **Privacy / framing guard:** "show up where connection happens" (public events/clubs) — never matchmaking or pointing at specific strangers. Keeps it warm and safe.
- **No auth.** Single hardcoded user for the demo. (Auth is the classic time sink; cut it.)

### 6b. User flows

**Flow A — Cast a wish**
Speak wish ("I wish I had a boyfriend") → blow to cast (tap fallback) → catkins scatter → `wishes` row created → Willow asks 1–3 intake Qs by voice → answers stored on `wishes.intake` → "Okay — I'm on it."

**Flow B — Daily proactive loop (THE demo)**
Willow greets warmly (name + 1 remembered detail) → shows 1–3 `pending` suggestions (real SF places) → user accepts/declines by voice or tap → signal written to Supermemory + `events` → next batch filtered/reordered by learned preference → willow grows on accept.

**Flow C — Adapt + remember (the proof)**
On re-open (pre-seeded "day-2"), greeting references yesterday and the AdaptBanner shows the learned shift ("skipped bars, loved outdoorsy — leaning in"). This is the retention proof; protect it with your life.

**Personality spec (the obsession-flip):** warm, delighted by you, gently encouraging when you decline, always rooting for the wish. Uses your name + one remembered detail per greeting. Celebrates *real* steps. Never guilt, never spam. Lives in the system prompt (`SYSTEM-PROMPTS.md`), kept consistent.

---

## ── FOR THE AGENT (how to build + verify) ── *(on — this deploys today; doubles as the Capy ticket contract)*

### 7. Acceptance criteria
- **A1 (cast):** speaking a wish creates a `wishes` row and transitions to intake; tap-to-cast always works even if mic-blow misfires.
- **A2 (intake):** 1–3 voice Qs captured onto `wishes.intake`; "I'm on it" advances to DailyScreen.
- **A3 (daily loop):** DailyScreen renders ≥1 `pending` suggestion with real SF place/when; Accept→`accepted`, Decline→`declined`, each writes an `events` signal.
- **A4 (adapt):** after ≥2 declines in a category + ≥1 accept in another, the next batch is reordered toward the accepted category AND the AdaptBanner states the learned preference in plain language.
- **A5 (remember):** greeting on re-open includes the user's name + one detail from Supermemory tied to yesterday.
- **A6 (alive):** a Convex `useQuery` drives the DailyScreen so an accept updates the tree/list without manual refresh.
- **A7 (tested):** one Revyl English flow passes end-to-end (wish → suggestion → accept → adapt) on an EAS build.

### 8. Files & interfaces
```
convex/schema.ts                 // users, wishes, suggestions, events (6a)
convex/wishes.ts                 // createWish(text), setIntake(wishId, intake)
convex/suggestions.ts            // nextBatch(wishId) -> Suggestion[]  (filter/reorder by prefs)
                                 // respond(suggestionId, 'accepted'|'declined')
convex/memory.ts                 // recordSignal(userId, signal), greeting(userId) -> string (Supermemory)
convex/seed.ts                   // import sf-suggestions.seed.json -> suggestions
app/WishScreen.tsx               // BlowToCast + record/STT
app/IntakeScreen.tsx
app/DailyScreen.tsx              // useQuery(suggestions), WillowGreeting, AdaptBanner, WillowTree
components/WillowTree.tsx        // sapling -> tree by accepted count
components/BlowToCast.tsx        // expo-audio metering; tap/hold fallback
lib/voice.ts                     // Deepgram STT (header `Token`), Aura/expo-speech TTS
lib/llm.ts                       // intake + adapt reasoning (Gemini/Anthropic key already local)
```

### 9. Scope fence
- **IN:** Flows A/B/C, 4 screens, Convex live store, Supermemory signal+greeting, seeded SF suggestions, one Revyl test.
- **OUT (vision, not today):** live event-search / web scraping, matchmaking, the learning/CS-tutor vertical (vision line only), Whop monetization (late stretch only), Keiki iMessage nudge (top stretch, only if core loop solid by mid-afternoon).
- **DO NOT TOUCH:** auth (skip), SM-2 spaced-repetition math (belongs to the learning vertical, not this build).

### 10. Build order (dependency-sequenced; maps to TIMELINE.md gates)
1. Baseline: create-expo-app → Convex connect → one live `useQuery` in Expo Go. **Lock first.**
2. Schema + seed import (`convex/schema.ts`, `seed.ts`).
3. Flow A: wish capture (voice→text) → `createWish` → intake → sapling.
4. Flow B: DailyScreen renders suggestions → accept/decline → `events` signal. **The demo.**
5. Flow C: Supermemory greeting + AdaptBanner reorder; willow grows.
6. Polish ONE path; pre-seed a "day-2" session so the remember moment works live; empty/loading states.
7. Mic-blow on top of tap (45-min box, polish window only); keep tap fallback.
8. Revyl English flow on EAS build; capture evidence. Submit.

**Cut-lines if behind (drop in order):** willow visual → progress bar; TTS out → show text, keep voice-*in*; LLM adapt → hardcoded reorder; Revyl → one minimal passing test. **Never cut:** voice-in + accept/decline + the "it remembers you" moment.

### 11. Verify
- `npx tsc --noEmit` (type-check the whole app).
- Convex: `npx convex dev` running; `npx convex run seed:import` populates `suggestions`.
- Smoke on phone (Expo Go): run Flows A→B→C manually; confirm A1–A6 by observation.
- Revyl: run the English flow against the EAS simulator build; confirm A7 passes; save the recording for the demo + submission.
