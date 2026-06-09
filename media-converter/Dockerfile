# Media converter image: Node + ffmpeg + yt-dlp.
# Using a Dockerfile is the most reliable way to get the ffmpeg and yt-dlp
# binaries onto Railway / Fly.io / any container host.
FROM node:20-slim

# ffmpeg (binary) + a recent yt-dlp (pulled directly from GitHub releases so it
# stays current; the Debian package lags badly). python3 is needed at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates curl \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install JS deps first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
