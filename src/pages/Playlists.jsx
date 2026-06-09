import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ListMusic,
  Plus,
  Loader2,
  ChevronRight,
  Lock,
  Globe,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';

import { listPlaylists, createPlaylist } from '@/lib/mediaLibrary';

const VISIBILITY_BADGE = {
  private: { icon: Lock, label: 'Private' },
  unlisted: { icon: Link2, label: 'Unlisted' },
  public: { icon: Globe, label: 'Public' },
};

/**
 * Playlists — list and create the user's playlists (Phase 3). Each card links to
 * the playlist detail page, where tracks are managed. Visibility is shown as a
 * badge; switching to shared/public is handled in the sharing phase.
 */
export default function Playlists() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPlaylists(await listPlaylists());
    } catch {
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function create(e) {
    e.preventDefault();
    const value = name.trim();
    if (!value || creating) return;
    setCreating(true);
    try {
      await createPlaylist({ name: value });
      setName('');
      toast.success(`Created “${value}”.`);
      refresh();
    } catch (err) {
      toast.error(err?.message || 'Could not create playlist.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-background pb-40"
      style={{
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <header className="border-b border-border bg-card/80 px-4 py-3">
        <Link
          to="/music"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Library
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <ListMusic className="h-5 w-5 text-primary" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Media
            </p>
            <h1 className="text-lg font-semibold leading-tight text-foreground">
              Playlists
            </h1>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-4 py-4">
        {/* Create */}
        <form onSubmit={create} className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New playlist name…"
            className="h-10 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={!name.trim() || creating}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </button>
        </form>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : playlists.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <ListMusic className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium text-foreground">No playlists yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Create one above, then add tracks from your library.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {playlists.map((p) => {
              const badge = VISIBILITY_BADGE[p.visibility] || VISIBILITY_BADGE.private;
              const Badge = badge.icon;
              return (
                <li key={p.id}>
                  <Link
                    to={`/playlists/${p.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-secondary/40">
                      <ListMusic className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Badge className="h-3 w-3" /> {badge.label} ·{' '}
                        {p.track_count || 0} track{(p.track_count || 0) === 1 ? '' : 's'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
