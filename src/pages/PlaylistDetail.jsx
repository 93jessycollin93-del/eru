import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  Plus,
  Loader2,
  Pencil,
  Check,
  Trash2,
  X,
  Music2,
  Lock,
  Globe,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  getPlaylist,
  getPlaylistTracks,
  updatePlaylist,
  deletePlaylist,
  removeTrackFromPlaylist,
} from '@/lib/mediaLibrary';
import { useMediaPlayer } from '@/context/MediaPlayerContext';
import { useAuth } from '@/lib/AuthContext';
import AddTracksToPlaylistSheet from '@/components/media/AddTracksToPlaylistSheet';

const VISIBILITY_BADGE = {
  private: { icon: Lock, label: 'Private' },
  unlisted: { icon: Link2, label: 'Unlisted' },
  public: { icon: Globe, label: 'Public' },
};

function fmt(s) {
  if (!s || !Number.isFinite(s)) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { current, isPlaying, playList, togglePlay } = useMediaPlayer();

  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([getPlaylist(id), getPlaylistTracks(id)]);
      setPlaylist(p);
      setTracks(t);
    } catch {
      setPlaylist(null);
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function startEdit() {
    setDraftName(playlist?.name || '');
    setDraftDesc(playlist?.description || '');
    setEditing(true);
  }

  async function saveEdit() {
    const name = draftName.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      await updatePlaylist(id, { name, description: draftDesc.trim() });
      setEditing(false);
      toast.success('Playlist updated.');
      refresh();
    } catch (err) {
      toast.error(err?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!window.confirm('Delete this playlist? Tracks stay in your library.')) return;
    try {
      await deletePlaylist(id);
      toast.success('Playlist deleted.');
      navigate('/playlists');
    } catch (err) {
      toast.error(err?.message || 'Could not delete playlist.');
    }
  }

  async function onRemoveTrack(track) {
    try {
      await removeTrackFromPlaylist(track._linkId, id);
      setTracks((prev) => prev.filter((t) => t._linkId !== track._linkId));
    } catch (err) {
      toast.error(err?.message || 'Could not remove track.');
    }
  }

  const onPlay = (index) => {
    const track = tracks[index];
    if (current?.id === track.id) togglePlay();
    else playList(tracks, index);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-sm text-foreground">Playlist not found.</p>
        <Link to="/playlists" className="text-[13px] text-primary hover:underline">
          Back to playlists
        </Link>
      </div>
    );
  }

  const badge = VISIBILITY_BADGE[playlist.visibility] || VISIBILITY_BADGE.private;
  const Badge = badge.icon;

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
          to="/playlists"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Playlists
        </Link>

        {editing ? (
          <div className="mt-2 space-y-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Playlist name"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
            />
            <textarea
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={saveEdit}
                disabled={!draftName.trim() || saving}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm text-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold leading-tight text-foreground">
                {playlist.name}
              </h1>
              {playlist.description && (
                <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">
                  {playlist.description}
                </p>
              )}
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge className="h-3 w-3" /> {badge.label} · {tracks.length} track
                {tracks.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                onClick={startEdit}
                aria-label="Edit playlist"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={onDelete}
                aria-label="Delete playlist"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => tracks.length && playList(tracks, 0)}
            disabled={tracks.length === 0}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> Play all
          </button>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium text-foreground hover:bg-accent"
          >
            <Plus className="h-4 w-4" /> Add tracks
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-2 px-4 py-4">
        {tracks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <Music2 className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium text-foreground">No tracks yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Use “Add tracks” to pull songs from your library.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {tracks.map((track, index) => {
              const active = current?.id === track.id;
              return (
                <li
                  key={track._linkId}
                  className={`flex items-center gap-3 rounded-2xl border p-2.5 transition-colors ${
                    active ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
                  }`}
                >
                  <span className="w-5 flex-shrink-0 text-center text-[12px] tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <button
                    onClick={() => onPlay(index)}
                    aria-label={active && isPlaying ? 'Pause' : 'Play'}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow hover:bg-primary/90"
                  >
                    {active && isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{track.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {track.artist || 'Unknown artist'}
                      {track.duration_sec ? ` · ${fmt(track.duration_sec)}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveTrack(track)}
                    aria-label="Remove from playlist"
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {adding && (
        <AddTracksToPlaylistSheet
          playlistId={id}
          existingTrackIds={tracks.map((t) => t.id)}
          userEmail={user?.email || ''}
          onClose={() => setAdding(false)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
