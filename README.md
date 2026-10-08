# Eru

A React + Vite web app (installable PWA): Telegram bots, an AI lab, a card game, a digital
economy, media and more.

**Agents and new contributors start at [AGENTS.md](AGENTS.md).** It is the global map, and
every area of the codebase is one link away from it.

## Run locally

1. `npm install`
2. Create `.env.local` with the backend values the app reads (see
   [docs/agents/commands.md](docs/agents/commands.md#setup)):

   ```
   VITE_BASE44_APP_ID=…
   VITE_BASE44_APP_BASE_URL=…
   ```

3. `npm run dev`

Before pushing: `npm run lint`, `npm run build`, `npm run compliance:security`.

## Backend status

The app still depends on the Base44 SDK and the definitions in `base44/`. That dependency is
quarantined: see rule 1 in [AGENTS.md](AGENTS.md#1-hard-rules-apply-everywhere).
