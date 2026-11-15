# Wish Willow — Community Backend (Engine B)

Convex backend for the multi-user **community** layer of Wish Willow: public
wishes, moderated comments (text / photo / video / match), threaded replies, and
1:1 direct messages. All files live in `convex/` and are drop-in ready for an
Expo + Convex app.

## Files

| File | What it does |
|---|---|
| `convex/schema.ts` | Table definitions + indexes, and shared validator fragments (`wishKind`, `visibility`, etc.) reused across functions. Every query access pattern has a matching `.index()` — no filter-scans. |
| `convex/users.ts` | `joinByHandle` (upsert a user by device token → returns the user) and `me` (resolve a user from a device token, or `null`). |
| `convex/wishes.ts` | `create`, `setVisibility`, `listPublic` (paginated public feed, newest first), `get`, plus the owner's **wish list**: `listMine` and `countMine`. |
| `convex/comments.ts` | `add` (inserts `approved:false`), `listForWish` (reactive; resolves `mediaId`→URL and attaches `authorHandle`), `approve` / `reject` (owner-only moderation). |
| `convex/dms.ts` | `getOrCreateConversation` (order-independent, idempotent), `sendMessage`, `listMessages` (paginated, newest first, media URLs resolved). |
| `convex/files.ts` | `generateUploadUrl` — short-lived upload URL for photo/video/avatar uploads. |
| `convex/seed.ts` | `demo` — idempotent seed of one public demo wish + a few approved demo comments. All seeded rows are self-evidently sample data. |

## Wish lists (a user's own wishes)

Every user has a **wish list** — the wishes they've made. Two queries in
`wishes.ts` serve it, both keyed on the `by_owner` index:

- `listMine({ ownerId, limit? })` — that user's wishes **newest first**,
  including **both private and public** wishes (it's the owner's own view). Each
  returned row carries `text`, `kind`, `visibility`, `status`, `reward`,
  `createdAt` (plus `_id` / `_creationTime`). Capped with `.take()` (default/max
  200) rather than paginated, since a personal wish list is small; swap in
  `paginationOptsValidator` the same way `listPublic` / `listMessages` do if a
  user's list is expected to grow past the cap.
- `countMine({ ownerId })` — the number of wishes the user has.

Both take `ownerId` as a client-supplied argument today; in production they move
to server-derived identity along with the rest of the mutations (see below).

## Identity model (hackathon)

Identity is **lightweight join-by-handle**: a device picks a `handle` and gets a
`deviceToken`-keyed user row. There are **no passwords and no server-derived
identity**. As a direct consequence:

- `wishes.create` / `setVisibility` take `ownerId` as an argument.
- `comments.add` takes `authorId`; `approve` / `reject` take `requesterId`.
- `dms.sendMessage` takes `authorId`.

These args are trusted for the hackathon only. **In production** this migrates to
real auth (e.g. Convex Auth or the YBuffet Cognito IdP), and every one of those
client-supplied id args becomes **server-derived from `ctx.auth.getUserIdentity()`**:

- Drop `ownerId` / `authorId` / `requesterId` from `args`.
- Resolve the caller's `users` row from the authenticated subject.
- Replace the current `requesterId !== wish.ownerId` comparison (already present
  in `approve` / `reject`) with a check against the server-derived identity, and
  add the same ownership/membership checks to `create`, `setVisibility`,
  `sendMessage`, and `listMessages`.

The ownership comparison logic is already in place for comment moderation and DM
membership — only the *source of the caller's identity* needs to change.

## Dropping into the Expo + Convex app

1. Copy every file in this `convex/` directory into your app's `convex/` dir
   (do **not** copy `_generated/` — Convex regenerates it).
2. Run `npx convex dev` once; it pushes the schema, builds indexes, and
   regenerates `convex/_generated/*`.
3. Call functions from React Native with `useQuery` / `useMutation`
   (e.g. `useQuery(api.wishes.listPublic, { paginationOpts })`).
4. Seed demo data with `npx convex run seed:demo` (or wire a dev-only button).

## Media uploads (photo / video / avatar)

Three-step flow using Convex file storage:

1. Client calls `files.generateUploadUrl` → gets a short-lived upload URL.
2. Client `POST`s the file bytes to that URL → the response JSON contains a
   `storageId`.
3. Client passes that `storageId` as `mediaId` on `comments.add` /
   `dms.sendMessage` (or as `avatarId` on a user).

**Store the `storageId`, never the URL** — URLs expire. Read paths
(`comments.listForWish`, `dms.listMessages`) resolve each stored `mediaId` to a
fresh URL via `ctx.storage.getUrl(...)` at query time and return it as
`mediaUrl`.

## Seed data integrity

`seed.demo` is idempotent (safe to re-run — it reuses rows by stable handle /
text and never duplicates). Per the project's hard rule — **real info only, no
fabrication presented as real** — every seeded row is self-evidently demo:
owner/commenter handles are prefixed `demo_` and all comment bodies are prefixed
`[demo]`.
