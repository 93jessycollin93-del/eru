# Media Converter Service

A small, standalone **Node + Express** service that turns a public media URL
(YouTube / TikTok / etc.) into an **MP3 / M4A / WAV** audio file or an **MP4**
video at a chosen resolution (240p–1080p), using **yt-dlp + ffmpeg**.

## Why is this a separate service?

`yt-dlp` and `ffmpeg` spawn OS processes and write temporary files. That makes
them **incompatible with serverless / hosted backends** (Base44, Lovable, Vercel
functions, Netlify, etc.), which don't allow long-running child processes or
local disk writes.

So this runs as its own always-on service on a VPS (Railway / Fly.io / Hetzner),
and your main app calls it over HTTP.

```
Your app (frontend) ──HTTP POST /convert──▶ this service (VPS) ──spawn──▶ yt-dlp + ffmpeg
        ▲                                          │
        └──────────── streamed file ◀──────────────┘
```

## API

### `GET /health`

Returns `{ "status": "ok", "uptime": <seconds> }`. Use it for uptime checks.

### `POST /convert`

Request body (JSON):

```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "format": "mp3",
  "acknowledged": true
}
```

| Field          | Type    | Notes                                                         |
| -------------- | ------- | ------------------------------------------------------------- |
| `url`          | string  | Must be `http(s)`.                                            |
| `format`       | string  | One of: `mp3`, `m4a`, `wav`, `240p`, `360p`, `480p`, `720p`, `1080p`. |
| `acknowledged` | boolean | **Must be `true`** or the request is rejected with `403`.     |

**Terms** the user must acknowledge:

> Only convert content you own or that is licensed for free use. You are
> responsible for ensuring you have the rights.

On success the service **streams the file back** with a `Content-Disposition`
attachment header (the converted file's name), then deletes the temp file.

#### Responses

| Status | Meaning                                                            |
| ------ | ----------------------------------------------------------------- |
| `200`  | File stream (audio/video).                                        |
| `400`  | Missing/invalid URL or unsupported format.                        |
| `403`  | `acknowledged !== true` — returns the terms text.                 |
| `413`  | Media exceeds the max duration (default 20 min).                  |
| `422`  | URL could not be read (private / unsupported / invalid).          |
| `429`  | Rate limit hit (10 requests / 15 min per IP).                     |
| `500`  | Conversion failed.                                                |

## Security

- **No shell injection.** Every argument is passed to `yt-dlp`/`ffmpeg` as an
  array element via `spawn(..., { shell: false })`. The URL and the media title
  are never interpolated into a shell string.
- **URL validation** — only `http(s)` URLs are accepted.
- **Length cap** — media longer than `MAX_DURATION_SECONDS` (default 20 min) is
  rejected after a cheap metadata probe, before any download.
- **Timeouts** — both the probe and the conversion have hard timeouts that
  `SIGKILL` the child process.
- **Rate limiting** — 10 requests / 15 minutes per IP on `/convert`.
- **CORS** — locked to the origins in `ALLOWED_ORIGINS`.
- **Temp files** — written to `<tmp>/conversions` with UUID names and **always
  cleaned up**, on both success and error.
- **Filename sanitization** — the media title is stripped of control characters
  and illegal filename/header characters before being used.

## Prerequisites

You need three things on the host: **Node 18+**, **ffmpeg**, and **yt-dlp**.

### Install ffmpeg

- **Debian/Ubuntu:** `sudo apt-get update && sudo apt-get install -y ffmpeg`
- **macOS (Homebrew):** `brew install ffmpeg`
- **Verify:** `ffmpeg -version`

### Install yt-dlp

The latest release tracks site changes far better than distro packages:

```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
yt-dlp --version
```

> yt-dlp needs Python 3 available on the host. On Debian/Ubuntu:
> `sudo apt-get install -y python3`.

## Run locally

```bash
cd media-converter
npm install
cp .env.example .env   # then edit values
npm start              # or: npm run dev  (auto-reload)
```

Smoke test:

```bash
curl http://localhost:8080/health

curl -X POST http://localhost:8080/convert \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","format":"mp3","acknowledged":true}' \
  --output out.mp3
```

## Environment variables

| Variable               | Default                | Description                                            |
| ---------------------- | ---------------------- | ------------------------------------------------------ |
| `PORT`                 | `8080`                 | Port to listen on (Railway/Fly set this for you).      |
| `ALLOWED_ORIGINS`      | _(empty = open)_       | Comma-separated browser origins allowed to call the API. **Set this in production.** |
| `MAX_DURATION_SECONDS` | `1200`                 | Max media length (seconds).                            |
| `PROBE_TIMEOUT_MS`     | `30000`                | Metadata probe timeout.                                |
| `CONVERT_TIMEOUT_MS`   | `300000`               | Conversion timeout.                                    |
| `YT_DLP_PATH`          | `yt-dlp`               | Override the yt-dlp binary path.                       |
| `TMP_DIR`              | `<os tmp>/conversions` | Where temp files are written.                          |

## Deploy to Railway

Railway can't run `apt-get`-only setups reliably for binary deps, so this repo
ships a **Dockerfile** that installs ffmpeg + yt-dlp. Railway auto-detects it.

1. Push this `media-converter/` folder to a GitHub repo (or use the existing one).
2. On [railway.app](https://railway.app): **New Project → Deploy from GitHub repo**.
3. If the converter isn't at the repo root, set the service's **Root Directory**
   to `media-converter` (Settings → Source).
4. Railway detects the `Dockerfile` and builds the image (Node + ffmpeg + yt-dlp).
5. Under **Variables**, set:
   - `ALLOWED_ORIGINS` = your app's origin(s), e.g. `https://your-app.base44.app`
   - (optional) `MAX_DURATION_SECONDS`, timeouts, etc.
   - Leave `PORT` unset — Railway injects it and the server reads it.
6. Under **Settings → Networking**, click **Generate Domain**. You'll get a URL
   like `https://media-converter-production.up.railway.app`.
7. Test it: `curl https://<your-domain>/health`.
8. Put that URL into your app's `VITE_MEDIA_CONVERTER_URL` env var (see the
   frontend feature).

### Deploy to Fly.io (alternative)

```bash
cd media-converter
fly launch --no-deploy        # creates fly.toml from the Dockerfile
fly secrets set ALLOWED_ORIGINS=https://your-app.base44.app
fly deploy
```

### Deploy to a Hetzner / generic VPS (alternative)

```bash
# Install Node 18+, ffmpeg, yt-dlp (see Prerequisites), then:
git clone <your repo> && cd media-converter
npm install --omit=dev
cp .env.example .env   # set ALLOWED_ORIGINS, etc.
# Keep it running with a process manager:
npm install -g pm2
pm2 start server.js --name media-converter
pm2 save
# Put NGINX/Caddy in front for TLS, pointing at 127.0.0.1:8080.
```

## Keeping yt-dlp fresh

Sites change often and break old yt-dlp builds. Re-pull the latest binary
periodically (the Docker image does this at build time, so a rebuild updates it):

```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp
```
