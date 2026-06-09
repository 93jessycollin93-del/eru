import { useEffect, useMemo, useState, useCallback } from 'react';
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
  Search,
  Tag as TagIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { listTracks, listTags, listAllTrackTags } from '@/lib/mediaLibrary';
import { useMediaPlayer } from '@/context/MediaPlayerContext';
import TrackTagEditor from '@/components/media/TrackTagEditor';

/** Seconds -> m:ss */
function fmt(s) {
  if (!s || !Number.isFinite(s)) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const SORTS = [
  { id: 'recent', label: 'Recent' },
  { id: 'title', label: 'Title' },
];

/**
 * MediaLibrary — your saved tracks, now with search, tag filtering, and sort
 * (Phase 2). Tracks play through the persistent, app-wide player. Drag-reorder,
 * playlists, stats and community browse arrive in later phases.
 */
export default function MediaLibrary() {
  const [tracks, setTracks] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [trackTags, setTrackTags] = useState([]); // all TrackTag link rows
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [activeTagId, setActiveTagId] = useState(null); // null = all
  const [sort, setSort] = useState('recent');
  const [editing, setEditing] = useState(null); // track being tagged

  const { current, isPlaying, playList, togglePlay, addToQueue } = useMediaPlayer();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [t, tags, links] = await Promise.all([
        listTracks(),
        listTags().catch(() => []),
        listAllTrackTags().catch(() => []),
      ]);
      setTracks(t);
      setAllTags(tags);
      setTrackTags(links);
    } catch {
      // Entities may still be syncing right after first deploy.
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTags = useCallback(async () => {
    const [tags, links] = await Promise.all([
      listTags().catch(() => []),
      listAllTrackTags().catch(() => []),
    ]);
    setAllTags(tags);
    setTrackTags(links);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // track_id -> link rows
  const tagsByTrack = useMemo(() => {
    const map = new Map();
    for (const link of trackTags) {
      if (!map.has(link.track_id)) map.set(link.track_id, []);
      map.get(link.track_id).push(link);
    }
    return map;
  }, [trackTags]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = tracks;

    if (activeTagId) {
      const allowed = new Set(
        trackTags.filter((l) => l.tag_id === activeTagId).map((l) => l.track_id),
      );
      rows = rows.filter((t) => allowed.has(t.id));
    }

    if (q) {
      rows = rows.filter((t) =>
        [t.title, t.artist, t.album, t.format]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q)),
      );
    }

    if (sort === 'title') {
      rows = [...rows].sort((a, b) =>
        (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }),
      );
    }
    return rows;
  }, [tracks, trackTags, activeTagId, query, sort]);

  const onPlay = (index) => {
    const track = filtered[index];
    if (current?.id === track.id) togglePlay();
    else playList(filtered, index);
  };

  const onQueue = (track) => {
    addToQueue(track);
    toast.success(`Added “${track.title}” to the queue.`);
  };

  const hasTracks = tracks.length > 0;

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
        {/* Search + sort */}
        {hasTracks && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, artist, format…"
                className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-9 text-sm text-foreground outline-none focus:border-primary"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full hover:bg-accent"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="flex overflow-hidden rounded-xl border border-border">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  className={`h-10 px-3 text-[12px] font-medium transition-colors ${
                    sort === s.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <button
              onClick={() => setActiveTagId(null)}
              className={`inline-flex h-8 flex-shrink-0 items-center gap-1 rounded-full border px-3 text-[12px] transition-colors ${
                activeTagId === null
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-accent'
              }`}
            >
              All
            </button>
            {allTags.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTagId(activeTagId === t.id ? null : t.id)}
                className={`inline-flex h-8 flex-shrink-0 items-center gap-1 rounded-full border px-3 text-[12px] transition-colors ${
                  activeTagId === t.id
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent'
                }`}
              >
                <TagIcon className="h-3 w-3" /> {t.name}
              </button>
            ))}
          </div>
        )}

        {/* List / empty states */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !hasTracks ? (
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
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-[13px] text-muted-foreground">
            No tracks match your search or filter.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((track, index) => {
              const active = current?.id === track.id;
              const trackTagRows = tagsByTrack.get(track.id) || [];
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
                    {trackTagRows.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {trackTagRows.map((l) => (
                          <button
                            key={l.id}
                            onClick={() => setActiveTagId(l.tag_id)}
                            className="inline-flex items-center rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            {l.tag_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setEditing(track)}
                    aria-label="Edit tags"
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <TagIcon className="h-4 w-4" />
                  </button>
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

      {editing && (
        <TrackTagEditor
          track={editing}
          tags={tagsByTrack.get(editing.id) || []}
          allTags={allTags}
          onClose={() => setEditing(null)}
          onChanged={refreshTags}
        />
      )}
    </div>
  );
}
