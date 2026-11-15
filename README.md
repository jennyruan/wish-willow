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

Users opt in from **@handle → Notifications → Daily nudge over text** by choosing iMessage or Telegram and entering where to be texted: their iMessage number (stored as E.164) or their numeric Telegram user ID (stored as `tg:<id>`, since Keiki addresses Telegram contacts by ID, not @username). A daily Convex cron (`convex/crons.ts`, 17:00 UTC) calls `nudge.sendDailyNudge` for each opted-in user who hasn't checked in within the last 20 hours. It posts a notice to the Willow agent's conversation with that recipient (`POST https://onkeiki.com/api/v1/developer/agents/<id>/notice`). The agent then texts the user over that channel in its own words, using only real data: handle, streak, and open wishes. Keiki can only reach someone who has texted the agent once. If it can't reach the user, the app marks them unreachable and shows how to text Willow first.

To turn it on:

1. In Keiki, create the Willow agent.
2. Connect a **free** channel only: the shared iMessage number (contacts text the agent's join code) or a Telegram bot. Don't buy a dedicated iMessage line.
3. Issue an API key with the `agents:write` scope and set it server-side, with the agent's ID: `npx convex env set KEIKI_API_KEY sk_...` and `npx convex env set KEIKI_AGENT_ID <agent id>`. Neither ships to the app.
4. Optionally set `KEIKI_SHARED_LINE` and `KEIKI_JOIN_CODE` (the shared iMessage number and join code) and `KEIKI_TELEGRAM_BOT` (the bot's username). The app shows these as "text Willow first" instructions.

## Tests

`npm test` runs the Convex function tests (vitest + convex-test). Whop and Keiki are mocked, and nothing calls a live API.
