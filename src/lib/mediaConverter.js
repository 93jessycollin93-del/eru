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
