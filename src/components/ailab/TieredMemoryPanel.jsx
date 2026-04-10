import { useEffect, useMemo, useState } from 'react';
import { Archive, Database, Layers3, Search, Download } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function TieredMemoryPanel({ bots }) {
  const [memories, setMemories] = useState([]);
  const [chunks, setChunks] = useState([]);
  const [selectedBot, setSelectedBot] = useState('all');
  const [search, setSearch] = useState('');
  const [archiving, setArchiving] = useState(false);

  const load = async () => {
    const [memoryRows, chunkRows] = await Promise.all([
      base44.entities.BotMemory.list('-created_date', 300),
      base44.entities.BotMemoryChunk.list('-created_date', 200),
    ]);
    setMemories(memoryRows);
    setChunks(chunkRows);
  };

  useEffect(() => { load(); }, []);

  const filteredChunks = useMemo(() => chunks.filter((chunk) => {
    const botMatch = selectedBot === 'all' || chunk.bot_id === selectedBot;
    const text = [chunk.summary, ...(chunk.keywords || [])].join(' ').toLowerCase();
    const searchMatch = text.includes(search.toLowerCase());
    return botMatch && searchMatch;
  }), [chunks, selectedBot, search]);

  const handleArchive = async () => {
    if (selectedBot === 'all') return;
    setArchiving(true);
    await base44.functions.invoke('archiveBotMemory', { botId: selectedBot });
    await load();
    setArchiving(false);
  };

  const getBotName = (botId) => bots?.find((bot) => bot.id === botId)?.name || 'Unknown bot';

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Layers3 className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Tiered Memory Storage</p>
        </div>
        <p className="text-xs text-muted-foreground">Hot memory stays in BotMemory for recent context, while warm and cold memory is chunked, summarized, archived in private storage, and indexed for retrieval.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-lg font-bold text-primary">{memories.length}</p>
          <p className="text-[10px] text-muted-foreground">Hot items</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-lg font-bold text-blue-400">{chunks.length}</p>
          <p className="text-[10px] text-muted-foreground">Indexed chunks</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-lg font-bold text-purple-400">{chunks.filter((item) => item.storage_tier === 'cold').length}</p>
          <p className="text-[10px] text-muted-foreground">Cold archives</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row">
        <select value={selectedBot} onChange={(e) => setSelectedBot(e.target.value)} className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none">
          <option value="all">All bots</option>
          {(bots || []).map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}
        </select>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 flex-1">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search summaries or keywords..." className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
        <button onClick={handleArchive} disabled={selectedBot === 'all' || archiving} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          {archiving ? 'Archiving...' : 'Archive bot memory'}
        </button>
      </div>

      <div className="space-y-3">
        {filteredChunks.map((chunk) => (
          <div key={chunk.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{getBotName(chunk.bot_id)}</p>
                <p className="text-[10px] text-muted-foreground">{chunk.storage_tier} tier · {chunk.message_count} messages</p>
              </div>
              {chunk.archive_signed_url && (
                <a href={chunk.archive_signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary">
                  <Download className="w-3 h-3" /> Archive
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{chunk.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {(chunk.keywords || []).slice(0, 8).map((keyword) => (
                <span key={keyword} className="rounded-full border border-border bg-secondary px-2 py-1 text-[10px] text-muted-foreground">{keyword}</span>
              ))}
            </div>
          </div>
        ))}
        {filteredChunks.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No archived memory chunks yet.
          </div>
        )}
      </div>
    </div>
  );
}