# Capy ticket — Wish Willow multi-user Convex backend + community layer

**How to use this:** paste each PR-shaped task below into Capy one at a time (app / Slack / Linear). Review + merge each PR before the next. The backend code in PR 1 is already written and Convex-lint-clean — **add these exact files, don't regenerate them** (Convex validator/index correctness is already handled). Identity is lightweight **join-by-handle** for the hackathon (no passwords); production migrates to real auth — see note at the end.

> **UI for every screen:** match `design/DESIGN.md` (tokens/components/layout) and `design/wish-willow-demo.html` (the clickable mockup — reimplement its look/flow in React Native, don't copy the HTML); use `design/wish-willow-logo.svg`.

> Supersedes the Gate A baseline: the `messages` table + `convex/messages.ts` were a placeholder to prove the live `useQuery` path. Once PR 2 lands, remove them (and the `App.tsx` reference) — the real tables are below.

---

## PR 1 — Backend: add the community + wishlist Convex functions

**Goal:** add the full Wish Willow backend (users, wishes, comments, DMs, file uploads, seed) to `convex/`. **Add these exact files** (replace `convex/schema.ts`):

**Files:** `convex/schema.ts`, `convex/users.ts`, `convex/wishes.ts`, `convex/comments.ts`, `convex/dms.ts`, `convex/files.ts`, `convex/seed.ts`

**Constraints:** keep the code verbatim (object-form syntax, `args`+`returns` validators, `.index()` on every access pattern, pagination validators, Convex file storage for media). Don't add `ctx.auth` yet — identity is client-supplied by design for the hackathon.

**Check:** `npx convex dev` compiles with no validator errors; run the `seed:demo` mutation; `wishes:listPublic` returns the seeded public wish and `comments:listForWish` returns its approved demo comments, both updating reactively.

### `convex/schema.ts`
```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const wishKind = v.union(
  v.literal("girlfriend"), v.literal("boyfriend"),
  v.literal("iphone"), v.literal("hackathon"), v.literal("other"),
);
export const locality = v.union(v.literal("local"), v.literal("remote"));
export const timeUnit = v.union(
  v.literal("days"), v.literal("weeks"), v.literal("months"), v.literal("years"),
);
export const visibility = v.union(v.literal("private"), v.literal("public"));
export const wishStatus = v.union(
  v.literal("open"), v.literal("fulfilled"), v.literal("closed"),
);
export const commentKind = v.union(
  v.literal("text"), v.literal("photo"), v.literal("video"), v.literal("match"),
);

export default defineSchema({
  users: defineTable({
    handle: v.string(),
    avatarId: v.optional(v.id("_storage")),
    deviceToken: v.string(),
    createdAt: v.number(),
  }).index("by_deviceToken", ["deviceToken"]).index("by_handle", ["handle"]),

  wishes: defineTable({
    ownerId: v.id("users"),
    text: v.string(),
    kind: wishKind,
    intake: v.optional(v.any()),
    locality: v.optional(locality),
    location: v.optional(v.string()),
    budget: v.optional(v.number()),
    timeNum: v.optional(v.number()),
    timeUnit: v.optional(timeUnit),
    visibility: visibility,
    reward: v.optional(v.number()),
    status: wishStatus,
    // "Reality": a wish that has come true — marked as reality in the UI.
    realized: v.boolean(),
    realizedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]).index("by_visibility", ["visibility"]),

  comments: defineTable({
    wishId: v.id("wishes"),
    authorId: v.id("users"),
    kind: commentKind,
    body: v.optional(v.string()),
    mediaId: v.optional(v.id("_storage")),
    parentId: v.optional(v.id("comments")),
    approved: v.boolean(),
    createdAt: v.number(),
  }).index("by_wish", ["wishId"]).index("by_wish_approved", ["wishId", "approved"]),

  conversations: defineTable({
    user1: v.id("users"), user2: v.id("users"), createdAt: v.number(),
  }).index("by_user1", ["user1"]).index("by_user2", ["user2"]).index("by_users", ["user1", "user2"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    authorId: v.id("users"),
    body: v.optional(v.string()),
    mediaId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),
});
```

> The remaining files — `users.ts`, `wishes.ts`, `comments.ts`, `dms.ts`, `files.ts`, `seed.ts` — are authored and ready at
> `~/projects/consumer-mobile-hackathon/convex-backend/convex/`. Copy them in verbatim. Key functions:
> - **users.ts** — `joinByHandle({handle, deviceToken})` (handles are **unique** — rejects a taken handle), `me({deviceToken})`, `getByHandle({handle})` (resolve a handle → user, for DM-by-handle)
> - **wishes.ts** — `create`, `setVisibility`, `listPublic` (paginated feed), `get`, **`listMine({ownerId})`** (the user's wish list), **`countMine`**, **`markRealized({wishId, requesterId, realized?})`** (owner-only; marks a wish as *reality*)
> - **comments.ts** — `add` (inserts `approved:true` — comments are all public), `listForWish({wishId, onlyApproved})` (reactive; resolves media URL + author handle), `reject` (owner-only remove/delete, post-moderation safety net)
> - **dms.ts** — `getOrCreateConversation`, `sendMessage`, `listMessages`
> - **files.ts** — `generateUploadUrl`
> - **seed.ts** — idempotent `demo` (one public demo wish + approved `[demo]`-prefixed comments)

---

## PR 2 — Wire identity, the wish, and the wish list

**Goal:** on launch, `joinByHandle` with a device-stored handle (prompt for a handle once). Replace the Gate A `messages` screen. Build: (a) the **wish list** home — `wishes:listMine(myId)`, newest first, each row showing kind/text/visibility/status; wishes where `realized === true` are **marked as reality** (a distinct "✓ came true" treatment). (b) Creating a wish calls `wishes:create`. (c) A **public feed** screen from `wishes:listPublic`.

**Files:** `App.tsx` + new screens/components; remove `convex/messages.ts` + the `messages` table.

**Check:** two devices/simulators each join with a handle; creating a wish on one shows it in that user's wish list; a public wish appears in the other's feed live.

---

## PR 3 — Community engagement (the live-demo win) + reality

**Goal:** on a public wish, a **comment thread** (Facebook/Reddit style): text + photo + video replies via `files:generateUploadUrl` → `comments:add`. **Comments are ALL PUBLIC — they appear immediately** (`comments:add` inserts `approved:true`; render with `listForWish onlyApproved:true`, which now returns everything). No pre-approval gate. The wish owner can **remove/delete** any reply after the fact via `comments:reject` (post-moderation safety net). Owner can **mark their wish as reality** (`wishes:markRealized`). **DMs are IN for v1** — `dms:getOrCreateConversation` + `sendMessage` + `listMessages`, 1:1 thread with text + media.

**Files:** comment thread + composer + media upload (photo/video), owner remove control, "mark as reality" control, DM thread screen.

**Check:** on device B, post a photo reply to device A's public wish → it appears **live immediately** on every screen; device A can remove it; a DM between A and B round-trips; device A marks the wish realized → it shows as reality in the wish list.

---

## PR 4 — AI layer: OpenAI clarify + research (Convex action)

**Goal:** Willow does real work via OpenAI (`gpt-6-luna`, $100 credits). Add `convex/ai.ts` with **actions** (not queries/mutations — only actions can fetch external APIs):
- `clarifyWish({ wishText, kind })` → calls OpenAI to turn a spoken wish into structured intake + the next 1–3 clarifying questions.
- `research({ wishId })` → loads the wish, calls OpenAI to search/assemble real options toward it, returns a plan with **cited sources** (real-info rule — no fabrication).

**Constraints:** read the key from `process.env.OPENAI_API_KEY` **server-side only** — never `EXPO_PUBLIC_*`, never in the client or repo. Actions use `"use node"` if a Node SDK is needed, or plain `fetch` to the OpenAI API. App calls via `useAction`.

**Prereqs (Jenny's one step):** redeem the $100 OpenAI link → create the key → `npx convex env set OPENAI_API_KEY sk-…` (and mirror into Capy Project env if Capy runs convex dev).

**Check:** calling `ai:clarifyWish` returns structured questions for a sample wish; `ai:research` returns a plan with real source URLs; the key never appears in the client bundle.

## Environment variables (Capy: + menu → Environment variables → Project)
Set the same keys in **both** Convex and Capy: `CONVEX_DEPLOY_KEY`, plus any LLM/STT keys the app uses (`DEEPGRAM_API_KEY`, Gemini/OpenAI). Media uploads need no extra config — Convex file storage is built in.

## Media upload flow (for PR 3)
1. client calls `files:generateUploadUrl` → gets a URL
2. client `POST`s the file bytes to that URL → gets back a `storageId`
3. client calls `comments:add` with `mediaId: storageId`
4. `listForWish` returns `mediaUrl` (resolved via `ctx.storage.getUrl`) for rendering

## Identity note (production migration)
`ownerId` / `authorId` / `requesterId` are client-supplied for the hackathon (join-by-handle, no passwords). Before any real launch: derive identity from server auth (`ctx.auth.getUserIdentity()`), drop those args, and move ownership checks server-side. For an `oi*` product this becomes YBuffet Cognito.

## Project rule (hard constraint)
Real info only — no fabricated data presented as real (see `RULES.md`). Seed data is self-evidently demo (`demo_` handles, `[demo]` bodies). Device specs/prices, events, and hackathon info must come from live sources.
