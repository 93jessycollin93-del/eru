/**
 * MediaPlayerContext — the app's single, root-level playback store.
 * ----------------------------------------------------------------
 * Mounted once above the router (see App.jsx) so playback survives navigation
 * between sections. Pages call `useMediaPlayer()` to start tracks, control
 * playback, and manage the temporary up-next queue. The persistent player UI
 * (PersistentPlayer, mounted in Layout) reads the same state.
 *
 * The queue is a TEMPORARY play queue, separate from saved playlists: you can
 * add tracks to "up next" without editing any playlist.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as audioEngine from '@/lib/audioEngine';
import { recordPlay } from '@/lib/mediaLibrary';

const MediaPlayerContext = createContext(null);

export function MediaPlayerProvider({ children }) {
  const [current, setCurrent] = useState(null); // the playing Track
  const [queue, setQueue] = useState([]); // upcoming Tracks (up-next)
  const [history, setHistory] = useState([]); // played Tracks (for "previous")
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);

  // Keep the latest queue/current/volume in refs so engine callbacks (registered
  // once) always see fresh values without re-binding handlers on every render.
  const queueRef = useRef(queue);
  const currentRef = useRef(current);
  const volumeRef = useRef(volume);
  queueRef.current = queue;
  currentRef.current = current;
  volumeRef.current = volume;

  const playTrackInternal = useCallback((track, { recordHistory = true } = {}) => {
    if (!track?.file_url) return;
    setCurrent(track);
    setPosition(0);
    setDuration(track.duration_sec || 0);
    audioEngine.load(track.file_url, { autoplay: true, volume: volumeRef.current });
    if (recordHistory) recordPlay(track).catch(() => {});
  }, []);

  const handleEnd = useCallback(() => {
    const q = queueRef.current;
    const playing = currentRef.current;
    if (q.length > 0) {
      const [next, ...rest] = q;
      setQueue(rest);
      if (playing) setHistory((h) => [...h, playing]);
      playTrackInternal(next);
    } else {
      setIsPlaying(false);
      setPosition(0);
    }
  }, [playTrackInternal]);

  // Keep a ref to the latest handleEnd so the engine effect can register once
  // and never tear down/reload audio when unrelated state (e.g. volume) changes.
  const handleEndRef = useRef(handleEnd);
  handleEndRef.current = handleEnd;

  // Register engine handlers exactly once, on mount.
  useEffect(() => {
    audioEngine.setHandlers({
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onProgress: (secs, dur) => {
        setPosition(secs);
        if (dur) setDuration(dur);
      },
      onLoad: (dur) => setDuration(dur),
      onEnd: () => handleEndRef.current(),
      onError: () => setIsPlaying(false),
    });
    return () => audioEngine.unload();
  }, []);

  // ---- Public API --------------------------------------------------------

  /** Play a single track now. Optionally seed the up-next queue. */
  const playTrack = useCallback((track, nextQueue = null) => {
    if (Array.isArray(nextQueue)) setQueue(nextQueue);
    playTrackInternal(track);
  }, [playTrackInternal]);

  /** Play a list of tracks (e.g. a playlist) starting at `startIndex`. */
  const playList = useCallback((tracks = [], startIndex = 0) => {
    if (!tracks.length) return;
    const idx = Math.max(0, Math.min(startIndex, tracks.length - 1));
    setQueue(tracks.slice(idx + 1));
    setHistory([]);
    playTrackInternal(tracks[idx]);
  }, [playTrackInternal]);

  const togglePlay = useCallback(() => audioEngine.togglePlay(), []);

  const next = useCallback(() => handleEnd(), [handleEnd]);

  const previous = useCallback(() => {
    // Restart current if we're more than 3s in; otherwise go to previous track.
    if (position > 3 || history.length === 0) {
      audioEngine.seek(0);
      setPosition(0);
      return;
    }
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    if (currentRef.current) setQueue((q) => [currentRef.current, ...q]);
    playTrackInternal(prev, { recordHistory: false });
  }, [position, history, playTrackInternal]);

  const seek = useCallback((secs) => {
    audioEngine.seek(secs);
    setPosition(secs);
  }, []);

  const setVolume = useCallback((v) => {
    setVolumeState(v);
    audioEngine.setVolume(v);
  }, []);

  // ---- Queue (up-next) ----------------------------------------------------

  const addToQueue = useCallback((track) => {
    setQueue((q) => [...q, track]);
  }, []);

  const addManyToQueue = useCallback((tracks = []) => {
    setQueue((q) => [...q, ...tracks]);
  }, []);

  const removeFromQueue = useCallback((index) => {
    setQueue((q) => q.filter((_, i) => i !== index));
  }, []);

  const clearQueue = useCallback(() => setQueue([]), []);

  const playFromQueue = useCallback((index) => {
    setQueue((q) => {
      const track = q[index];
      if (!track) return q;
      if (currentRef.current) setHistory((h) => [...h, currentRef.current]);
      playTrackInternal(track);
      return q.filter((_, i) => i !== index);
    });
  }, [playTrackInternal]);

  const value = useMemo(() => ({
    current,
    queue,
    isPlaying,
    position,
    duration,
    volume,
    hasTrack: Boolean(current),
    playTrack,
    playList,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    addToQueue,
    addManyToQueue,
    removeFromQueue,
    clearQueue,
    playFromQueue,
  }), [
    current, queue, isPlaying, position, duration, volume,
    playTrack, playList, togglePlay, next, previous, seek, setVolume,
    addToQueue, addManyToQueue, removeFromQueue, clearQueue, playFromQueue,
  ]);

  return (
    <MediaPlayerContext.Provider value={value}>
      {children}
    </MediaPlayerContext.Provider>
  );
}

export function useMediaPlayer() {
  const ctx = useContext(MediaPlayerContext);
  if (!ctx) {
    throw new Error('useMediaPlayer must be used within a MediaPlayerProvider');
  }
  return ctx;
}
