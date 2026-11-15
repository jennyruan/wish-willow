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

## Secrets

Only `EXPO_PUBLIC_*` variables are bundled into the app, and `EXPO_PUBLIC_CONVEX_URL` is the only one the app needs. Any third-party API key belongs in the Convex deployment (`npx convex env set NAME value`) and is read with `process.env.NAME` inside a Convex action, never in app code.
