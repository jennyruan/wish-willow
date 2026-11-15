# Wish Willow 🌳🍀

**Make a wish. Something falls in love with helping you keep it.**

You speak a wish out loud; Willow makes a plan and **comes to you every day with the next real step** — finding the events, places, and people, and adapting as it learns you.

- **Demo vertical:** finding connection in SF. The engine is vertical-agnostic.
- **Built for:** YC Consumer Mobile Hackathon (Nov 15, 2026).
- **Stack:** Expo (SDK 55, `expo-audio`) · Convex · Capy · Revyl · Supermemory · Deepgram voice.

The core loop is the whole product:

> **voice wish → a real suggestion appears → accept/decline → it visibly adapts and remembers.**

See **[PRD.md](./PRD.md)** for the full spec — problem, data model, user flows, acceptance criteria, build order, and verification. It doubles as the Capy ticket contract.

## Optional: daily nudge over text (Keiki)

Users can opt in from **@handle → Notifications → Daily nudge over text**. A daily Convex cron (`convex/crons.ts`, 17:00 UTC) calls `nudge.sendDailyNudge` for each opted-in user who hasn't checked in in the last 20 hours. It calls the Willow agent through Keiki's OpenAI-compatible gateway (`https://onkeiki.com/api/v1/openai`) with the agent name `willow` as the model and the user's id as `x-conversation-id`, and writes the check-in from real data only: handle, streak, and open wishes.

To turn it on:

1. In Keiki, create an agent named `willow` and turn on its API gateway.
2. Connect a **free** channel only: the shared iMessage number (contacts text the agent's join code) or a Telegram bot. Don't buy a dedicated iMessage line.
3. Issue an API key with the `agents:chat` scope and set it server-side: `npx convex env set KEIKI_API_KEY sk_...`. It never ships to the app.
