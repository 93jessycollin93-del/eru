# Services & shared assets map

↑ [AGENTS.md](../../AGENTS.md) · build and run → [commands.md](commands.md)

These live in this repo but outside the main app's build. Each standalone service has its
own `package.json` and is installed and run from its own folder.

## Router Console

Folder: `router-console/`.

An offline-first PWA for router control and agent orchestration from a phone. ESLint skips it
(`eslint.config.js`).

| Path | What |
|---|---|
| `router-console/package.json` | Express server; `npm start` / `npm run dev` |
| `router-console/server.js` | static server + API (port `PORT`, default 8000) |
| `router-console/hue-service.js` | Philips Hue bridge control on the local network |
| `router-console/public/index.html`, `router-console/public/sw.js` | the PWA and its service worker |
| `router-console/README.md`, `QUICK_START.md`, `PHONE_DEPLOYMENT.md` | usage and phone deployment guides |

## Media Converter

Folder: `media-converter/`.

A Node/Express service that turns a public media URL into audio or video (yt-dlp + ffmpeg).
It runs on a separate host. The app reaches it through `VITE_MEDIA_CONVERTER_URL`
(`src/lib/mediaConverter.js`).

| Path | What |
|---|---|
| `media-converter/server.js` | `GET /health`, `POST /convert` (rate-limited); port `PORT`, default 8080; CORS from `ALLOWED_ORIGINS` |
| `media-converter/Dockerfile` | container image with yt-dlp and ffmpeg |
| `media-converter/package.json` | `npm start` / `npm run dev` |
| `media-converter/README.md` | deploy and config guide |
| App side | `src/pages/MediaConverter.jsx` (`/media-converter`), `src/components/media/YouTubeImportSheet.jsx` |

## PWA shell

Folder: `public/`.

| Path | What |
|---|---|
| `public/sw.js` | service worker (registered in `src/main.jsx`); caches the app shell, never API calls |
| `public/manifest.json` | install manifest |
| `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` | local app icons (used by `index.html` and the manifest) |
| `public/app-commander.html` | standalone App Commander launcher; shares its fetch layer with `src/lib/jackyClient.ts` |

## Fleet design kit

Folder: `src/fleet-ui/`.

The eYe design system shared by the fleet apps (PC, Eru, Jackie, Cybernetic Empath). It is
**copied verbatim** into each repo, so edit it upstream and propagate rather than changing it here.

| Path | What |
|---|---|
| `src/fleet-ui/README.md` | how the kit works and how to adopt it |
| `src/fleet-ui/eye-theme.css` | raw `--eye-*` tokens plus an opt-in shadcn bridge (needs `<html data-eye-theme>`), imported by `src/index.css` |
| `src/fleet-ui/tailwind-eye-preset.cjs` | Tailwind preset, loaded in `tailwind.config.js` |
| Shared client | `src/lib/jackyClient.ts` (also shared verbatim) |
| Fleet plan | `FLEET_PARITY_PLAN.md`, `PARITY_MATRIX.md` |
