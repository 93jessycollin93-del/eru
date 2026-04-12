import { Database, Search } from 'lucide-react';

function getMatches(entry, query) {
  const text = [entry.goal, entry.result_summary, entry.source_squad_name, ...(entry.keywords || [])].join(' ').toLowerCase();
  return query.toLowerCase().split(' ').filter((word) => word.length > 2 && text.includes(word)).length;
}

export default function SquadKnowledgePanel({ knowledgeItems, search, setSearch }) {
  const filtered = !search.trim()
    ? knowledgeItems.slice(0, 6)
    : [...knowledgeItems]
        .map((entry) => ({ entry, matches: getMatches(entry, search) }))
        .filter((item) => item.matches > 0)
        .sort((a, b) => b.matches - a.matches)
        .map((item) => item.entry)
        .slice(0, 6);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-primary" />
        <div>
          <p className="text-xs font-semibold text-foreground">Squad knowledge base</p>
          <p className="text-[10px] text-muted-foreground">Search successful outcomes from any squad before running a new pipeline.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <Search className="w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search goals, summaries, or keywords"
          className="w-full bg-transparent text-xs text-foreground outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No matching knowledge yet.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-foreground">{entry.goal}</p>
                <span className="text-[9px] text-primary">{entry.source_squad_name}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground line-clamp-3">{entry.result_summary}</p>
              {(entry.keywords || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {entry.keywords.slice(0, 5).map((keyword) => (
                    <span key={keyword} className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] text-primary">
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}