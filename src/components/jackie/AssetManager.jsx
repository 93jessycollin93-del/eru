import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { FolderOpen, Search, Pin, Trash2, Copy, PenLine, Code, Layout, Bot, Zap, FileText, Check, ArrowRight, Download } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from '@/components/ui/use-toast';

const TAG_ICONS = { code: Code, ui: Layout, system: Zap, bot: Bot, strategy: Zap, prompt: FileText, general: FileText };
const TAG_COLORS = { code: 'text-green-400', ui: 'text-purple-400', system: 'text-blue-400', bot: 'text-cyan-400', strategy: 'text-orange-400', prompt: 'text-pink-400', general: 'text-muted-foreground' };

export default function AssetManager({ onInject, userEmail }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, [userEmail]);

  const load = async () => {
    setLoading(true);
    try {
      const items = userEmail
        ? await base44.entities.JackieSaved.filter({ created_by: userEmail }, '-created_date', 100).catch(() => [])
        : await base44.entities.JackieSaved.list('-created_date', 100).catch(() => []);
      setAssets((items || []).filter((item) => item.tag !== 'conversation'));
    } finally {
      setLoading(false);
    }
  };

  const del = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await base44.entities.JackieSaved.delete(pendingDelete.id);
      await load();
      toast({ title: 'Asset deleted' });
    } catch (error) {
      toast({ title: 'Delete failed', description: error?.message || 'Could not delete this asset.', variant: 'destructive' });
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  };

  const togglePin = async (a) => {
    try {
      await base44.entities.JackieSaved.update(a.id, { pinned: !a.pinned });
      await load();
    } catch (error) {
      toast({ title: 'Update failed', description: error?.message || 'Could not update this asset.', variant: 'destructive' });
    }
  };

  const rename = async (id) => {
    if (!editTitle.trim()) return;
    try {
      await base44.entities.JackieSaved.update(id, { title: editTitle.trim() });
      setEditId(null);
      await load();
      toast({ title: 'Asset renamed' });
    } catch (error) {
      toast({ title: 'Rename failed', description: error?.message || 'Could not rename this asset.', variant: 'destructive' });
    }
  };

  const duplicate = async (a) => {
    try {
      await base44.entities.JackieSaved.create({
        title: `${a.title || 'Asset'} (copy)`,
        content: a.content,
        tag: a.tag,
        asset_type: a.asset_type,
        folder: a.folder,
        created_by: userEmail || undefined,
      });
      await load();
      toast({ title: 'Asset duplicated' });
    } catch (error) {
      toast({ title: 'Duplicate failed', description: error?.message || 'Could not duplicate this asset.', variant: 'destructive' });
    }
  };

  const downloadAsset = (a) => {
    const extension = a.tag === 'bot' ? 'json' : 'txt';
    const blob = new Blob([a.content || ''], { type: extension === 'json' ? 'application/json' : 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(a.title || 'asset').replace(/\s+/g, '-').toLowerCase()}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => assets.filter((a) => {
    if (filterTag && a.tag !== filterTag) return false;
    if (search && !a.title?.toLowerCase().includes(search.toLowerCase()) && !a.content?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const pinDelta = Number(b.pinned) - Number(a.pinned);
    if (pinDelta !== 0) return pinDelta;
    return new Date(b.updated_date || b.created_date || 0) - new Date(a.updated_date || a.created_date || 0);
  }), [assets, filterTag, search]);

  const tags = [...new Set(assets.map((a) => a.tag).filter(Boolean))];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets..." className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground" />
      </div>

      {tags.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto">
          <button onClick={() => setFilterTag(null)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs border transition-all ${!filterTag ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border'}`}>
            All
          </button>
          {tags.map((t) => (
            <button key={t} onClick={() => setFilterTag(filterTag === t ? null : t)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs border transition-all capitalize ${filterTag === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border'}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{search || filterTag ? 'No matching assets' : 'No assets yet'}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Save replies, prompts, and code from Jackie to build your own working library.</p>
        </div>
      ) : filtered.map((a) => {
        const TagIcon = TAG_ICONS[a.tag] || FileText;
        const tagColor = TAG_COLORS[a.tag] || 'text-muted-foreground';
        return (
          <div key={a.id} className={`bg-card border rounded-xl p-3.5 transition-all ${a.pinned ? 'border-primary/30' : 'border-border'}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <TagIcon className={`w-3.5 h-3.5 flex-shrink-0 ${tagColor}`} />
                {editId === a.id ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 bg-secondary border border-border rounded-lg px-2 py-1 text-xs outline-none text-foreground" autoFocus />
                    <button onClick={() => rename(a.id)} className="text-primary"><Check className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <p className="text-xs font-medium truncate">{a.title || 'Untitled'}</p>
                )}
              </div>
              {a.pinned && <Pin className="w-3 h-3 text-primary flex-shrink-0" />}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap">{a.content}</p>
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              <button onClick={() => { onInject(a.content); toast({ title: 'Asset loaded into Jackie' }); }} className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-medium">
                <ArrowRight className="w-2.5 h-2.5" /> Use
              </button>
              <button onClick={() => togglePin(a)} className="px-2 py-1 bg-secondary border border-border rounded-lg text-[10px] text-muted-foreground">
                <Pin className="w-2.5 h-2.5" />
              </button>
              <button onClick={() => { setEditId(a.id); setEditTitle(a.title || ''); }} className="px-2 py-1 bg-secondary border border-border rounded-lg text-[10px] text-muted-foreground">
                <PenLine className="w-2.5 h-2.5" />
              </button>
              <button onClick={() => duplicate(a)} className="px-2 py-1 bg-secondary border border-border rounded-lg text-[10px] text-muted-foreground">
                <Copy className="w-2.5 h-2.5" />
              </button>
              <button onClick={() => downloadAsset(a)} className="px-2 py-1 bg-secondary border border-border rounded-lg text-[10px] text-muted-foreground">
                <Download className="w-2.5 h-2.5" />
              </button>
              <button onClick={() => setPendingDelete(a)} className="px-2 py-1 bg-destructive/10 border border-destructive/20 rounded-lg text-[10px] text-destructive">
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        );
      })}

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Delete ${pendingDelete?.title || 'this asset'}?`}
        description="This removes the saved asset from your Jackie library."
        confirmLabel="Delete"
        tone="danger"
        busy={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={del}
      />
    </div>
  );
}
