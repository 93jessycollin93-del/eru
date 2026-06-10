/**
 * Media Converter — client config & helpers.
 *
 * Talks to the standalone converter service (Node + Express running yt-dlp +
 * ffmpeg on a VPS). The service base URL is provided at build time via
 *   VITE_MEDIA_CONVERTER_URL=https://media-converter-production.up.railway.app
 *
 * The converter CANNOT live in the Base44 serverless backend because yt-dlp and
 * ffmpeg spawn processes and write temp files. See /media-converter for the
 * service itself.
 */

export const CONVERTER_BASE_URL =
  (import.meta.env?.VITE_MEDIA_CONVERTER_URL || '').replace(/\/$/, '');

/** True when a converter URL has been configured. */
export const isConverterConfigured = () => Boolean(CONVERTER_BASE_URL);

/** The exact terms the user must acknowledge before converting. */
export const ACK_TERMS =
  'Only convert content you own or that is licensed for free use. ' +
  'You are responsible for ensuring you have the rights.';

/** Audio formats — rendered as a row of tappable buttons. */
export const AUDIO_FORMATS = [
  { id: 'mp3', label: 'MP3' },
  { id: 'm4a', label: 'M4A' },
  { id: 'wav', label: 'WAV' },
];

/** Video formats (mp4) — one button per resolution. */
export const VIDEO_FORMATS = [
  { id: '240p', label: '240p' },
  { id: '360p', label: '360p' },
  { id: '480p', label: '480p' },
  { id: '720p', label: '720p' },
  { id: '1080p', label: '1080p' },
];

const ALL_FORMAT_IDS = new Set(
  [...AUDIO_FORMATS, ...VIDEO_FORMATS].map((f) => f.id),
);

export const isValidFormat = (id) => ALL_FORMAT_IDS.has(id);

/** Lightweight http(s) URL check for the input field. */
export function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Pull a filename out of a Content-Disposition header, if present. */
function filenameFromDisposition(disposition, fallback) {
  if (!disposition) return fallback;
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i.exec(disposition);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return fallback;
}

/**
 * Call POST /convert, returning the converted file as a Blob plus its filename.
 * Throws an Error with a human-readable `.message` on failure (the converter
 * returns JSON error bodies).
 *
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function convertMedia({ url, format, acknowledged, signal }) {
  if (!isConverterConfigured()) {
    throw new Error(
      'The converter service URL is not configured (VITE_MEDIA_CONVERTER_URL).',
    );
  }

  const res = await fetch(`${CONVERTER_BASE_URL}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, format, acknowledged }),
    signal,
  });

  if (!res.ok) {
    // The service sends JSON error bodies like { error, detail }.
    let message = `Conversion failed (${res.status}).`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* non-JSON error body — keep the default message */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const filename = filenameFromDisposition(
    res.headers.get('Content-Disposition'),
    `download.${format.includes('p') ? 'mp4' : format}`,
  );
  return { blob, filename };
}

/** True when a URL looks like a YouTube/youtu.be link. */
export function isYouTubeUrl(value) {
  if (typeof value !== 'string') return false;
  return /(youtube\.com|youtu\.be|yesplaylist)/i.test(value);
}

/**
 * Fetch lightweight metadata for a YouTube URL WITHOUT downloading the file.
 * Calls GET /metadata on the converter service with an 8-second timeout.
 * Returns sensible defaults on any failure so the UI always has something.
 *
 * @param {string} url  A YouTube URL
 * @returns {Promise<{ title: string, artist: string, duration_sec: number, cover_url: string, format: string, url: string }>}
 */
export async function ytMetadataPreview(url) {
  const defaults = {
    title: 'YouTube Video',
    artist: 'YouTube',
    duration_sec: 0,
    cover_url: '',
    format: 'mp3',
    url,
  };

  if (!isConverterConfigured()) return defaults;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const attempt = async () => {
    const res = await fetch(
      `${CONVERTER_BASE_URL}/metadata?url=${encodeURIComponent(url)}`,
      { signal: controller.signal },
    );
    if (!res.ok) {
      let msg = 'Metadata fetch failed.';
      try { const d = await res.json(); if (d?.error) msg = d.error; } catch {}
      throw new Error(msg);
    }
    return res.json();
  };

  try {
    let data = null;
    // Up to 2 retries with 3s delay for transient failures.
    for (let attempt_n = 0; attempt_n <= 2; attempt_n++) {
      try {
        data = await attempt();
        break;
      } catch (err) {
        if (err?.name === 'AbortError') break; // timeout — don't retry
        if (attempt_n === 2) break;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    if (!data) return defaults;
    return {
      title: data.title || defaults.title,
      artist: data.uploader || data.channel || defaults.artist,
      duration_sec: Math.round(data.duration || 0),
      cover_url: data.thumbnail || '',
      format: 'mp3',
      url,
    };
  } catch {
    return defaults;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Make a raw yt-dlp / converter error message human-friendly.
 * @param {string|Error} err
 * @returns {string}
 */
export function friendlyConverterError(err) {
  const msg = (typeof err === 'string' ? err : err?.message) || '';
  if (/private|unavailable|removed/i.test(msg))
    return "That video is private or unavailable. Try a different URL.";
  if (/age.restrict/i.test(msg))
    return "That video is age-restricted and can't be fetched.";
  if (/network|ECONNREFUSED|fetch/i.test(msg))
    return "Couldn't reach the converter service. Check your connection and try again.";
  if (/format|no formats/i.test(msg))
    return "No downloadable format found for that URL.";
  if (/copyright|blocked/i.test(msg))
    return "That video is blocked due to copyright restrictions.";
  if (!msg || msg.length > 200) return "Conversion failed. Is the URL public?";
  return msg;
}

/** Trigger a browser download for a Blob. */
export function triggerDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}