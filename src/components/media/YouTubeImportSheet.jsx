import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Youtube, Loader2, CheckCircle2, AlertTriangle,
  Music, Clock, AlertCircle, Radio,
} from 'lucide-react';
import { toast } from 'sonner';
import { ytMetadataPreview, isYouTubeUrl, friendlyConverterError } from '@/lib/mediaConverter';
import { importYouTubeTrack } from '@/lib/mediaLibrary';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic gradient from a string (for cover art fallback). */
function titleGradient(title = '') {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  const hue1 = h % 360;
  const hue2 = (hue1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${hue1},60%,30%), hsl(${hue2},70%,20%))`;
}

/** Format seconds → M:SS  (or "?:??" when 0 / falsy). */
function fmtDuration(sec) {
  if (!sec || sec <= 0) return '?:??';
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/** Detect playlist URLs and reject them early. */
function isPlaylistUrl(url) {
  return /[?&]list=/.test(url) && !/[?&]v=/.test(url);
}

/** Heuristic: is the metadata for a livestream / premiere? */
function looksLiveMeta(meta) {
  if (!meta) return false;
  const t = (meta.title || '').toLowerCase();
  return meta.is_live || t.includes('live stream') || t.includes('premiere');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function YouTubeImportSheet({ open, onClose }) {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [meta, setMeta] = useState(null);
  const [warning, setWarning] = useState(''); // non-blocking warning
  const [metaError, setMetaError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTrack, setSavedTrack] = useState(null);
  const previewTimeout = useRef(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setUrl(''); setMeta(null); setMetaError('');
      setWarning(''); setConfirmed(false);
      setSavedTrack(null); setSaving(false);
    }
  }, [open]);

  // Debounced metadata fetch
  useEffect(() => {
    clearTimeout(previewTimeout.current);
    setMeta(null); setMetaError(''); setWarning('');
    setConfirmed(false); setSavedTrack(null);

    const trimmed = url.trim();
    if (!trimmed || !isYouTubeUrl(trimmed)) return;

    // Reject playlist-only URLs immediately
    if (isPlaylistUrl(trimmed)) {
      setMetaError('That looks like a playlist. Paste one video URL at a time.');
      return;
    }

    previewTimeout.current = setTimeout(async () => {
      setPreviewing(true);
      try {
        const data = await ytMetadataPreview(trimmed);

        // Normalise missing title
        if (!data.title || data.title === 'YouTube Video') {
          data.title = `Unknown Title — ${trimmed}`;
        }

        // Edge-case warnings (non-blocking)
        if (looksLiveMeta(data)) {
          setWarning("This looks like a livestream or premiere. Try a finished video instead.");
        } else if (data.duration_sec > 3600) {
          setWarning("This is a long video; conversion may take 2–3 min.");
        }

        setMeta(data);
      } catch (err) {
        setMetaError(friendlyConverterError(err));
      } finally {
        setPreviewing(false);
      }
    }, 800);

    return () => clearTimeout(previewTimeout.current);
  }, [url]);

  async function handleSave() {
    if (!meta || saving) return;
    setSaving(true);
    try {
      // Store the YouTube URL directly as file_url — no blob upload needed.
      // The player/converter service streams from the URL at playback time.
      const track = await importYouTubeTrack({ url: url.trim(), metadata: meta });
      setSavedTrack(track);
      toast.success('Added to your library.');
    } catch (err) {
      const msg = friendlyConverterError(err);
      // Map HTTP codes to friendlier messages
      const mapped =
        /403|geo.restrict/i.test(msg) ? "This video isn't available (geo-restricted or private)." :
        /404|not found/i.test(msg)    ? "Video not found. Is the URL correct?" :
        msg;
      toast.error(mapped);
    } finally {
      setSaving(false);
    }
  }

  function handleAddAnother() {
    setUrl(''); setMeta(null); setMetaError('');
    setWarning(''); setConfirmed(false); setSavedTrack(null);
  }

  if (!open) return null;

  const urlIsYt = isYouTubeUrl(url.trim());
  const urlInvalid = url.length > 5 && !urlIsYt;
  const canSave = meta && confirmed && !saving && !savedTrack;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border-t border-border bg-card shadow-2xl"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/15">
              <Youtube className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Import from YouTube</p>
              <p className="text-[10px] text-muted-foreground">Paste a URL — preview, edit, then save</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 pb-2">
          {/* URL input */}
          <div>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={saving}
              className="w-full rounded-xl border border-border bg-secondary/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60"
            />
            {urlInvalid && (
              <p className="mt-1 text-[11px] text-destructive">
                That doesn't look like a YouTube URL. Try youtube.com or youtu.be links.
              </p>
            )}
          </div>

          {/* Loading */}
          {previewing && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <p className="text-[12px] text-muted-foreground">Fetching video info…</p>
            </div>
          )}

          {/* Hard error */}
          {metaError && !previewing && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
              <p className="text-[12px] text-destructive">{metaError}</p>
            </div>
          )}

          {/* Non-blocking warning */}
          {warning && meta && !previewing && (
            <div className="flex items-start gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5">
              {warning.includes('livestream') ? (
                <Radio className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400" />
              )}
              <p className="text-[12px] text-yellow-300">{warning}</p>
            </div>
          )}

          {/* Metadata preview card */}
          {meta && !previewing && !savedTrack && (
            <MetaPreviewCard meta={meta} onChange={setMeta} />
          )}

          {/* Confirm checkbox */}
          {meta && !previewing && !savedTrack && (
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                Metadata looks good — save this track to my library.
              </span>
            </label>
          )}

          {/* Success */}
          {savedTrack && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <p className="text-[12px] font-medium text-primary">Added to library!</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {!savedTrack ? (
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  <><Music className="h-4 w-4" /> Save to Library</>
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={handleAddAnother}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-transparent text-sm font-medium text-foreground hover:bg-secondary/60"
                >
                  Add another
                </button>
                <button
                  onClick={() => { onClose(); navigate('/music'); }}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                >
                  Open Library
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetaPreviewCard
// ---------------------------------------------------------------------------

function MetaPreviewCard({ meta, onChange }) {
  const [imgFailed, setImgFailed] = useState(false);

  function update(field, value) {
    onChange((prev) => ({ ...prev, [field]: value }));
  }

  const hasCover = meta.cover_url && !imgFailed;
  const gradient = titleGradient(meta.title);
  const duration = fmtDuration(meta.duration_sec);

  return (
    <div className="rounded-xl border border-border bg-secondary/30 overflow-hidden">
      <div className="flex gap-3 p-3">
        {/* Thumbnail / gradient fallback */}
        <div className="flex-shrink-0">
          {hasCover ? (
            <img
              src={meta.cover_url}
              alt=""
              className="h-16 w-16 rounded-lg object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div
              className="h-16 w-16 rounded-lg flex items-center justify-center"
              style={{ background: gradient }}
            >
              <Music className="h-5 w-5 text-white/60" />
            </div>
          )}
        </div>

        {/* Editable fields */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <input
            type="text"
            value={meta.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-border bg-secondary/60 px-2 py-1 text-[12px] font-medium text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <input
            type="text"
            value={meta.artist}
            onChange={(e) => update('artist', e.target.value)}
            placeholder="Artist / Channel"
            className="w-full rounded-lg border border-border bg-secondary/60 px-2 py-1 text-[11px] text-muted-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{duration}</span>
          </div>
        </div>
      </div>
    </div>
  );
}