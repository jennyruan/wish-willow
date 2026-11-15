# wish-willow

Expo (React Native, TypeScript) app with expo-router and a Convex backend. Runs in Expo Go.

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

## Memory and ranking

Willow's per-user memory lives in [Supermemory](https://supermemory.ai) and is only ever called from Convex actions (`convex/memory.ts`), with the user's id as the namespace. Creating a wish (`wishes:create`) remembers it, accepting or declining a suggestion records a one-line preference, and each of those reranks the pending suggestions (`convex/ranking.ts`) using what was recalled.

```sh
npx convex env set SUPERMEMORY_API_KEY sm_...   # optional: without it, memory falls back to the preferences table
npx convex env set ANTHROPIC_API_KEY sk-ant-... # optional: without it, ranking orders by liked/disliked categories
```

## Voice wishes and intake

"Make a Wish" records the wish with `expo-audio`, uploads the clip to Convex file storage, and `voice:transcribe` sends it to Deepgram (`nova-3`, smart formatting) and deletes the clip. The transcript is stored with `wishes:start`, then `intake:generateQuestions` asks an LLM for 2 to 3 short clarifying questions (what kind of connection, how soon), which the user answers by voice the same way. `wishes:completeIntake` saves the answers on the wish, remembers it, and reranks suggestions. If the microphone is denied or recording or transcription fails, the screen switches to a text box so the flow keeps going.

```sh
npx convex env set DEEPGRAM_API_KEY ...   # required for speech-to-text; without it the app falls back to typing
npx convex env set OPENAI_API_KEY sk-...  # intake questions use gpt-6-luna, else GEMINI_API_KEY (gemini-3.8-flash), else ANTHROPIC_API_KEY
```

With no LLM key, or if every provider fails, intake asks two default questions.

## Secrets

Only `EXPO_PUBLIC_*` variables are bundled into the app, and `EXPO_PUBLIC_CONVEX_URL` is the only one the app needs. Any third-party API key belongs in the Convex deployment (`npx convex env set NAME value`) and is read with `process.env.NAME` inside a Convex action, never in app code.
