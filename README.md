# Eru

A React + Vite web app (installable PWA): Telegram bots, an AI lab, a card game, a digital
economy, media and more.

**Agents and new contributors start at [AGENTS.md](AGENTS.md).** It is the global map, and
every area of the codebase is one link away from it.

## Run locally

1. `npm install`
2. `npm run dev`

No backend is connected. Pages open and local features work, but sign-in, saved data and
server features stay off until a backend is added behind `src/api/backend.js`
(see [docs/agents/backend.md](docs/agents/backend.md)).

Before pushing: `npm run lint`, `npm run build`, `npm run compliance:security`.
