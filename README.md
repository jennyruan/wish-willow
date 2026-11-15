# Wish Willow 🌳🍀

**Make a wish. Something falls in love with helping you keep it.**

You speak a wish out loud; Willow makes a plan and **comes to you every day with the next real step** — finding the events, places, and people, and adapting as it learns you.

- **Demo vertical:** finding connection in SF. The engine is vertical-agnostic.
- **Built for:** YC Consumer Mobile Hackathon (Nov 15, 2026).
- **Stack:** Expo (SDK 55, `expo-audio`) · Convex · Capy · Revyl · Supermemory · Deepgram voice.

The core loop is the whole product:

> **voice wish → a real suggestion appears → accept/decline → it visibly adapts and remembers.**

See **[PRD.md](./PRD.md)** for the full spec — problem, data model, user flows, acceptance criteria, build order, and verification. It doubles as the Capy ticket contract.

## Getting started

```sh
npm install
npx convex dev            # signs in, creates a deployment, writes .env.local with EXPO_PUBLIC_CONVEX_URL
npx convex run seed:seedSuggestions   # inserts San Francisco suggestions if the table is empty
npm start                 # scan the QR code with Expo Go
```

Keep `npx convex dev` running while you work so function changes sync to your dev deployment.

## Layout

- `src/app/`: expo-router screens (`index.tsx` home, `suggestions.tsx` pending suggestions).
- `convex/`: schema (`wishes`, `suggestions`, `preferences`), queries and mutations, and the seed.

## Secrets

Only `EXPO_PUBLIC_*` variables are bundled into the app, and `EXPO_PUBLIC_CONVEX_URL` is the only one the app needs. Any third-party API key belongs in the Convex deployment (`npx convex env set NAME value`) and is read with `process.env.NAME` inside a Convex action, never in app code.
