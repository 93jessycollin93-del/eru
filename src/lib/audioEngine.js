/**
 * audioEngine — a thin singleton wrapper around Howler.js.
 * -------------------------------------------------------
 * Owns the actual <audio> playback so the React layer (MediaPlayerContext) can
 * stay declarative. One Howl plays at a time today; the module is structured so
 * a second Howl can be layered in later for gapless/crossfade playback without
 * changing the public API the context depends on.
 *
 * The engine is intentionally UI-agnostic: it knows nothing about tracks,
 * playlists, or the queue. It just plays a URL and reports progress/lifecycle
 * via callbacks.
 */

import { Howl, Howler } from 'howler';

let howl = null;
let raf = null;

const handlers = {
  onProgress: null, // (seconds, duration) => void
  onEnd: null, // () => void
  onPlay: null, // () => void
  onPause: null, // () => void
  onLoad: null, // (duration) => void
  onError: null, // (err) => void
};

function stopProgressLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
}

function startProgressLoop() {
  stopProgressLoop();
  const tick = () => {
    if (howl && howl.playing()) {
      const seconds = howl.seek() || 0;
      handlers.onProgress?.(seconds, howl.duration() || 0);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

/** Register lifecycle callbacks (the context wires these to React state). */
export function setHandlers(next = {}) {
  Object.assign(handlers, next);
}

/**
 * Load a URL and (optionally) start playing. Unloads any previous Howl.
 * @param {string} url
 * @param {{ autoplay?: boolean, volume?: number, format?: string[] }} opts
 */
export function load(url, { autoplay = true, volume = 1, format } = {}) {
  unload();
  howl = new Howl({
    src: [url],
    html5: true, // stream rather than fully buffering — needed for long audio
    volume,
    format,
    onplay: () => {
      handlers.onPlay?.();
      startProgressLoop();
    },
    onpause: () => {
      handlers.onPause?.();
      stopProgressLoop();
    },
    onend: () => {
      stopProgressLoop();
      handlers.onEnd?.();
    },
    onload: () => handlers.onLoad?.(howl?.duration() || 0),
    onloaderror: (_id, err) => handlers.onError?.(err),
    onplayerror: (_id, err) => {
      // Autoplay can be blocked until a user gesture; retry on unlock.
      handlers.onError?.(err);
      howl?.once('unlock', () => howl?.play());
    },
  });
  if (autoplay) howl.play();
  return howl;
}

export function play() {
  howl?.play();
}

export function pause() {
  howl?.pause();
}

export function togglePlay() {
  if (!howl) return;
  if (howl.playing()) howl.pause();
  else howl.play();
}

export function isPlaying() {
  return Boolean(howl?.playing());
}

/** Seek to a position in seconds. */
export function seek(seconds) {
  if (howl) howl.seek(seconds);
}

export function getPosition() {
  return howl ? howl.seek() || 0 : 0;
}

export function getDuration() {
  return howl ? howl.duration() || 0 : 0;
}

/** Master volume 0..1. */
export function setVolume(v) {
  Howler.volume(Math.max(0, Math.min(1, v)));
}

export function unload() {
  stopProgressLoop();
  if (howl) {
    howl.unload();
    howl = null;
  }
}
