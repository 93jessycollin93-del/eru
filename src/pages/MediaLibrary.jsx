import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Library,
  Play,
  Pause,
  ListPlus,
  Music2,
  Plus,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { listTracks } from '@/lib/mediaLibrary';
import { useMediaPlayer } from '@/context/MediaPlayerContext';

/** Seconds -> m:ss */
function fmt(s) {
  if (!s || !Number.isFinite(s)) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * MediaLibrary — your saved tracks (Phase 1).
 *
 * Lists tracks saved from the converter and plays them through the persistent,
 * app-wide player. Search/filter, tags, drag-reorder, playlists, stats and
 * community browse arrive in later phases; this page proves the data layer +
 * persistent player end-to-end.
 */
export default function MediaLibrary() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { current, isPlaying, playList, togglePlay, addToQueue } = useMediaPlayer();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setTracks(await listTracks());
    } catch {
      // Entity may still be syncing right after first deploy.
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onPlay = (index) => {
    const track = tracks[index];
    if (current?.id === track.id) {
      togglePlay();
    } else {
      playList(tracks, index);
    }
  };

  const onQueue = (track) => {
    addToQueue(track);
    toast.success(`Added “${track.title}” to the queue.`);
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-background pb-40"
      style={{
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* Header */}
      <header className="border-b border-border bg-card/80 px-4 py-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Home
        </Link>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Media
              </p>
              <h1 className="text-lg font-semibold leading-tight text-foreground">
                Your Library
              </h1>
            </div>
          </div>
          <Link
            to="/media-converter"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Add
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : tracks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <Music2 className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium text-foreground">No tracks yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Convert a link and save it to your library to start listening.
            </p>
            <Link
              to="/media-converter"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Convert a track
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {tracks.map((track, index) => {
              const active = current?.id === track.id;
              return (
                <li
                  key={track.id}
                  className={`flex items-center gap-3 rounded-2xl border p-2.5 transition-colors ${
                    active ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                  }`}
                >
                  <button
                    onClick={() => onPlay(index)}
                    aria-label={active && isPlaying ? 'Pause' : 'Play'}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow hover:bg-primary/90"
                  >
                    {active && isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {track.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {track.artist || 'Unknown artist'}
                      {track.format ? ` · ${track.format.toUpperCase()}` : ''}
                      {track.duration_sec ? ` · ${fmt(track.duration_sec)}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => onQueue(track)}
                    aria-label="Add to queue"
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <ListPlus className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
