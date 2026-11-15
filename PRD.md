# Wish Willow — PRD (v1, finalized 2026-11-15)

**YC Consumer Mobile Hackathon · Sun Nov 15 2026 · Expo + Convex + Capy + Revyl (+ Supermemory / Whop)**

> *Make a wish. Something falls in love with helping you keep it.*

**Operating model (Rule 0):** Claude Code plans, designs the UI, and writes this PRD + Capy tickets. **Capy writes all code, runs builds + Revyl tests, and submits PRs.** GitHub is the single source of truth. See `RULES.md`.

---

## ── FOR THE HUMAN (why) ──

### 1. Problem
People carry a wish they never get to — and every app waits for *them* to show up.

### 2. Why now
YC's bar is "an app people open again tomorrow." Companions talk but don't act; assistants act but don't know you or reach out; marketplaces need you to do the work. **No one combines proactive AI legwork + a community that helps + a wish-to-reality loop.** Voice + persona-memory is the edge that makes "it comes to you and it's *yours*" feel real. Fo by Wajo (see §6c) validates the agentic half; the community + wish framing is the open territory.

### 3. Solution
A voice companion devoted to helping you keep a wish. You speak it, Willow clarifies it, you blow to cast — then **either Willow quietly fulfills it for you (within your budget + timeline), or — if you make it public — the community helps, and you reward whoever does.** When it comes true, it's marked as **reality**.

### 4. Reasoning
- **Proactive, not reactive** — Willow comes to you. Fresh in a room of chatbots, and it *is* the "come back tomorrow" retention loop.
- **Two passes of the founder's filter** — fights loneliness (a patient daily presence) and democratizes a luxury (a 1:1 concierge + a crowd who helps).
- **The flip (hook)** — the 2025 film *Obsession* has a "One Wish Willow" whose wish becomes a curse on someone else. Wish Willow is the good version: the wish is *yours*, consensual, and the obsession belongs to the *agent*, pointed at your growth. Tagline: **wishes do come true.**
- **Vision line (close on this)** — *"Today it helps you find your person or your next thing. Tomorrow you wish for anything, and Willow — plus a community — conspires to make it real."*

---

## ── SHARED (what) ──

### 5. The flow (minimal, voice-first)
Splash (2s, logo) → **"I Wish"** home (4 affirmation cards) → clarify (adaptive) → "anything else" → **private/public** (+ reward if public) → **blow the willow** → Willow goes to work + daily check-ins.

**Demo wish types (stated as affirmations):**
- 💛 *I have a girlfriend* · 💙 *I have a boyfriend* — clarify: local/remote (Local → inline city/ZIP), **upload several photos of your type (multi-select)** + note, budget + timing, anything else, private/public.
- 📱 *I have an iPhone 18 Pro* — clarify: configuration (real Apple options: Pro/Pro Max · Silver/Black/Glacier/Burgundy · 256GB/512GB/1TB/2TB), location, budget + timing, private/public. Willow's help adapts to budget vs. real market price (buy / finance / crowdfund) + surfaces the hackathon RSVP (its real 1st prize is an iPhone 18 Pro per team member — a genuine path to the wish). All hackathon facts are live/verified (eligibility: Capy+Revyl+Convex; submit by 6:30 PM).
- 📊 *I can see how the YC Consumer Mobile Hackathon's going* — clarify: what to track, private/public → a live status digest.

**Inputs:** voice is first-class on every screen (mic); timing uses a number picker + unit (days/weeks/months/years).

### 6. Product architecture — two engines, one front

**6.0 Shared front.** Speak → Willow clarifies (incl. **private vs. public**) → confirm + blow → Willow works + runs a proactive daily check-in. The willow visibly grows as a wish progresses.

**Every solution is actionable, end-to-end (no dead-end cards).** Each result card Willow surfaces is a real, tappable action that moves the wish forward and confirms a next-state — e.g. **RSVP** (deep link to the real event), **Reserve/Buy** (via the single-use card), **Pick a helper → release reward** (Whop), **Start financing / crowdfund**, **Turn on daily check-ins**, **Mark as reality**. The user can actually take the step toward making the wish come true, not just read about it.

**6a. Engine A — Willow does it (agentic).** Works quietly to fulfill the wish within **budget + timeline**.
- **AI layer (OpenAI, $100 hackathon credits, model `gpt-6-luna`):** powers Willow's *actual work* — (1) **wish clarification** (turn a spoken wish into structured intake + the right follow-up questions) and (2) **online research** (search real sources to assemble a plan / real options toward the wish). This is the proof that Willow does real legwork, not canned replies. Research obeys the real-info rule — cite the source + fetch time; never fabricate (§13 Rule 1). **Voice:** Deepgram STT + **Deepgram Aura TTS** (Willow's spoken voice). **Memory:** **Supermemory (v1)** stores Willow's learned profile of each user (preferences, facts, wins) scoped by `userId` — makes clarification/greetings feel devoted and sharpens research over time; the `sm_` key is **server-side only (proxied)**, never shipped in the app.
- v1 stops short of unattended spend: Willow does the work, then hands a **one-tap-to-authorize** result ("found it, $80 of your $100 — blow to confirm"). The second blow = spend authorization.
- **Spend mechanism (from Fo by Wajo):** a **single-use virtual card capped at budget** — Willow transacts without holding the user's money or being a money-mover (dodges money-transmitter/visa weight).

**6b. Engine B — the community does it (social).** Willow drafts a post → confirm + blow → posts publicly → collects updates, checks in, and coaches. Two modes: **(i) Honor** — someone fulfills it (`publish → honorers reply → wisher selects → reward releases`); **(ii) Coach** — Willow + crowd advise what *you* can do.
- **Reward:** free (thanks) or paid, **no cap on the amount (the user sets it)**. UI = quick-pick chips ($0 / $25 / $50 / $100) + a custom "price it" field. Paid rail = **Whop** (merchant-of-record; Convex holds state). **Escrow = charge-on-select.**
- **When budget < price (e.g. the iPhone wish), Willow opens real paths:** **crowdfunding** — a Willow-**drafted title + post** the user can use, plus a list of real crowdfunding sites (GoFundMe · Fundly · Chuffed · GiveSendGo); and **financing** — a list of legit pay-over-time options (Apple Card Monthly Installments · Affirm · Klarna · PayPal Pay Later). Real links; real-info rule applies.

**6c. Comparable — Fo by Wajo (positioning).** *wajo.ai* — AI action-agent that does to-dos within boundaries, buys via single-use cards, escalates to humans. Validates Engine A. Our wedge: **wishes not to-dos · a public community marketplace with rewards · place-anchored · voice-first consumer mobile.** Demo the community path — the part Fo lacks.

### 7. Identity, data model, and the multi-user system

**Identity — join-by-handle (locked).** Each device has a `deviceToken`; user picks a handle; `joinByHandle` upserts a user. **Handles are unique** (a handle is a valid DM address — `joinByHandle` rejects a taken handle). No passwords — a whole room joins by QR in seconds. Production migrates to real auth / YBuffet Cognito.

**Data model (Convex):**
```
users         { handle, avatarId?, deviceToken, createdAt }
wishes        { ownerId, text, kind, intake?, locality?, location?, lat?, lng?, budget?,
                timeNum?, timeUnit?, visibility, reward?, status,
                realized, realizedAt?, createdAt }     // a user's wish list = their rows
comments      { wishId, authorId, kind(text|photo|video|match), body?, mediaId?,
                parentId?, approved, createdAt }        // threaded, moderated
conversations { user1, user2, createdAt }               // DMs (in for v1)
messages      { conversationId, authorId, body?, mediaId?, createdAt }
notifications { userId, kind(comment|fund|rsvp|reward|match), text, wishId?, read, createdAt }
media         // Convex file storage (photo/video), referenced by mediaId
```

**Data storage.** **Convex is the system of record for ALL app data** — users, wishes, comments, DMs, uploaded media, rewards — for **every user, including test users**. **Supermemory holds only the derived per-user profile** (preferences/facts/wins), not the records. Both are cloud (Convex + Supermemory). This tensions with the global local-first rule; for the hackathon it's expected (required sponsor tools), but **production should migrate to local-first + consent** (migration item). **Notifications are generated from real events:** a new comment → `comment`; a Whop payment webhook → `fund` / `reward`; an RSVP/action approval → `rsvp`; a matchmaker reply → `match`.

**Profile menu (handle, top-right).** Layout: **logo + "I Wish" left-aligned; the user's handle (initial-only avatar) in the top-right.** Tapping it opens a menu with three tabs:
- **🔔 Notifications** — new comments, and action-item updates: *crowdfunding funds came in, an RSVP was approved, a reward released, a match replied.* Tapping a notification deep-links to the relevant wish.
- **🌳 Wishes** — the user's **wish list**, each labeled **in progress** or **✓ true** (realized). Every wish is **clickable → detail** (status + the **action list**).
- **✉️ DMs** — conversation list → a thread the user can read and reply in.

**Navigation & engagement.**
- **Bottom tab bar** on the home/menu/community screens (hidden during the wish flow so it doesn't fight the input): **🔔 Notifications · ✉️ DMs · 🌳 Wishes · 👥 Community.**
- **👥 Community ("the grove")** — a feed of public wishes near you (wisher, location, reply count, reward), the social front door.
- **🔥 Daily wish-check streak** pill at the top — counts consecutive days the user checks in, to drive daily return (the retention loop made explicit). Streak state lives in Convex per user.

**Modify a wish.** From a wish's detail, **Modify** opens the wish for editing. **If Willow already has the essential info, modifying skips the clarification flow** — straight to edit + regenerate the action list. If the wish **already came true**, the user chooses: **make it a new wish** (keeps the old one as reality) or **override** it (reopen with updated details) — either way a fresh action list is generated.

**Location (real geocoding, auto).** When a user types a city or ZIP, Willow resolves it **automatically** (debounced on input — no extra tap) via a `geo.geocode` Convex action using free, keyless geocoding — **Zippopotam.us** for US ZIPs, **Open-Meteo geocoding** for city names — returning a normalized label + `lat/lng` stored on the wish. The public feed can then **filter/sort by proximity** to the viewer. Fits the real-info rule (real geographic data; if it can't resolve, say so, don't guess).

**iPhone finishes show real color swatches** — each finish chip renders a color block approximated from Apple's named finishes (Silver / Black / Glacier / Burgundy).

**How multi-user works:**
1. Make a wish → if **Public**, it enters everyone's feed (`listPublic`).
2. Others reply — **text, photo, or video** (upload via `generateUploadUrl` → `comments.add`). **Comments are all public — they appear immediately**, no approval gate.
3. Comments update **live** for everyone (Convex reactivity — like a shared Google Doc).
4. **Safety net (post-moderation, not a gate):** the wish owner can **remove/delete** any reply after the fact. No pre-approval.
5. **DMs (v1):** 1:1 via `getOrCreateConversation` + `sendMessage` (text + media). Start a DM by **tapping a comment author** (you have their id) or by **typing a unique handle** (`getByHandle` → `getOrCreateConversation`).
6. Owner **marks the wish as reality** (`markRealized`) when it comes true.

**Every user has a wish list** (`listMine` / `countMine`): their own wishes, newest first; realized ones shown as **reality**.

### 8. Access & distribution — single path: Capy → Revyl
The hackathon stack **Capy + Revyl + Convex is "Required to win."** The app is an **Expo** app (Expo Router + TypeScript — required); Convex is the backend (via `EXPO_PUBLIC_CONVEX_URL`); it is built and demoed through **Capy → Revyl**. **There is no web build, no Expo Web, and no Vercel/EAS web hosting** — that path is dropped. One channel only:

- **Capy Cloud Build → Revyl cloud phone.** Capy builds the **Expo iOS simulator build on Revyl's runners** (JS bundled, `EXPO_PUBLIC_CONVEX_URL` set) and launches it on a **cloud phone** (`viewer_url`) that **Jenny and the judge open in any browser** — full **native** experience (voice + blow), zero install. This path *"needs no Revyl account, key or environment variable"* (hackathon Revyl page) — Capy's own Capy↔Revyl integration handles it (needs Capy Pro+, **covered by the free Capy Max month**). Proof of Changes adds a plain-English validation + recorded session on PRs. **Multi-user** is shown with **2 cloud phones** (both hit the same Convex backend → they see each other live). Build prompt (hackathon-sanctioned): *"Build the iOS app in this repo on Revyl as a standalone simulator build with the JavaScript bundled and `EXPO_PUBLIC_CONVEX_URL` set."*
- *(Optional, native-on-physical-phone for Jenny's own testing only: Expo Go via QR — not a distribution channel, not required.)*

> **Env/keys (per hackathon pages):** store `CONVEX_DEPLOY_KEY` (Convex dev deployment, "Select all") in Capy project env; ensure `EXPO_PUBLIC_CONVEX_URL` is set wherever the build runs (`.env.local` is git-ignored, so set it in the Revyl build env / Capy env). Convex free tier = 1M function calls/mo. Convex is backend-only — it does **not** host a frontend.

### 9. Design system (hand to Capy as the design contract)
Vintage novelty / two-color letterpress. Colors: `paper #EBE0C6 · red #B23A2C · red-deep #8E2C20 · ink #241C16 · ochre #C68A38`. Fonts: **Anton** (logotype/buttons) · **Yeseva One** (the "wish" voice / questions) · **DM Sans** (body/UI). Motifs: willow-twig roundel logo, starbursts, "1 wish" badge, letterpress grain, stamp-buttons with hard red-deep drop-shadow, catkin blow animation. Reference the aesthetic, draw original marks (not the film's artifact). Reference mockup: `wish-willow-demo.html`; logo: `wish-willow-logo.svg`.

**Responsive (required):** the UI auto-adapts to **all device sizes** — small phones (iPhone SE) → large (Pro Max) → tablets — using flex layouts, relative units, and **safe-area insets**; no fixed heights. **Layout convention: logo pinned at the top, the wish input pinned at the bottom**, content between. The "I Wish" home must **fit on one screen without scrolling** on the smallest common phone (text sizes scale down to fit, e.g. the "I Wish" title stays compact).

---

## ── FOR THE AGENT (Capy build contract) ──

### 10. Scope
- **v1 IN:** the flow (splash → I Wish → clarify → private/public → blow), 4 demo wish types, join-by-handle (unique handles), wish list, Engine A (safe form: OpenAI clarify + online research → a real result within budget/timeline; Deepgram STT + Aura TTS; **Supermemory** remembers-you profile), Engine B public feed + comments all-public (text/photo/video) + reward-on-select (Whop, no cap), **DMs** (tap-author or by handle), mark-as-reality; **Capy Cloud Build → Revyl cloud phone** (required-to-win integration) with Proof of Changes.
- **OUT (dropped):** Expo Web build, react-native-web, Vercel/EAS web hosting, any public web URL — not building these.
- **Stretch:** unattended Engine A spend, Keiki iMessage nudge.
- **OUT:** real matchmaking of specific strangers without consent; production auth.

### 11. Build order (PR-shaped for Capy; see `CAPY-TICKET-convex.md`)
1. **Backend** — add the Convex schema + functions (users/wishes/comments/dms/files/seed) verbatim; run seed; verify `listPublic`/`listForWish` reactive.
2. **Identity + wish + wish list** — join-by-handle on launch; create wish; wish-list home (realized = reality); public feed.
3. **Community** — comment thread (text/photo/video via upload), **comments all public (no gate)** with owner remove/delete as a safety net, mark-as-reality; **DMs**.
4. **Capy Cloud Build → Revyl (PRIMARY, required-to-win)** — ensure `CONVEX_DEPLOY_KEY` + `EXPO_PUBLIC_CONVEX_URL` are set in Capy env; Capy builds the Expo iOS simulator build on Revyl (JS bundled) and launches it on a cloud phone (`viewer_url`); enable Proof of Changes (plain-English validation) on PRs. This is the judge-facing + required integration path.
5. **Engine A** — Willow assembles a budgeted result + one-tap authorize (single-use card pattern).
6. **(Done via the Revyl path)** — the judge + Jenny open the Revyl cloud-phone `viewer_url` in a browser. No separate web build.

### 12. Verify
- `npx convex dev` compiles (validators/indexes clean); seed populates demo data (self-evidently labeled).
- Two devices/sessions: public wish on one appears in the other's feed; a photo reply posts and shows **live immediately** (no gate); owner can remove it; DM round-trips; mark-as-reality flips a wish to reality.
- Zero-install: open the Revyl cloud-phone `viewer_url` in a browser → join by handle → comment on a public wish → it appears live (second cloud phone shows it live = multi-user).
- Revyl: Proof of Changes is enabled (PR gets a visual verdict + screenshots); at least one English flow passes on the cloud/EAS build; a shareable preview link + session recording exist for the pitch.

### 13. Hard rules (`RULES.md`)
- **Rule 0 — we plan, Capy builds.** No app code / commits / pushes from us.
- **Rule 1 — real info only.** Prices (Apple), events, hackathon facts from live sources; keep source + fetch time; missing data → say so; demo/seed data visibly labeled.
- **Consent & privacy.** Photos/info of real third parties (matchmaking) need consent before they're shown; test-user data lives in the cloud for the demo, so use demo data + a quick verbal OK from live participants; production = local-first + consent.
