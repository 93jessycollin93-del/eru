import { Plus, Pencil, Copy, Trash2, MessageSquare, Bot as BotIcon, Loader2, Sparkles } from 'lucide-react';

/** BotGallery — grid of bot cards with Activate / Edit / Duplicate / Delete. */
export default function BotGallery({ bots, pods, loading, onNew, onActivate, onEdit, onDuplicate, onDelete }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!bots.length) {
    return (
      <div className="eru-theme-card rounded-2xl border border-dashed border-border p-8 text-center">
        <BotIcon className="mx-auto h-8 w-8 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium text-foreground">No bots yet</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Create your first offline bot or agent to start chatting with Ollama.
        </p>
        <button
          onClick={onNew}
          className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New Bot
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {bots.length} bot{bots.length === 1 ? '' : 's'}
        </p>
        <button
          onClick={onNew}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {bots.map((bot) => (
          <BotCard
            key={bot.id}
            bot={bot}
            podCount={(bot.memory_pod_ids || []).length}
            onActivate={() => onActivate(bot)}
            onEdit={() => onEdit(bot)}
            onDuplicate={() => onDuplicate(bot)}
            onDelete={() => onDelete(bot)}
          />
        ))}
      </div>
    </div>
  );
}

function BotCard({ bot, podCount, onActivate, onEdit, onDuplicate, onDelete }) {
  return (
    <div className="eru-theme-card flex flex-col rounded-2xl border border-border p-3">
      <div className="flex items-center gap-2.5">
        <Avatar bot={bot} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{bot.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{bot.role || 'assistant'}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="inline-flex items-center rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground">
          {bot.model || '—'}
        </span>
        {bot.is_agent && (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] text-fuchsia-300">
            <Sparkles className="h-2.5 w-2.5" /> agent
          </span>
        )}
        {podCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground">
            {podCount} pod{podCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <button
        onClick={onActivate}
        className="mt-3 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
      >
        <MessageSquare className="h-4 w-4" /> Activate
      </button>
      <div className="mt-2 grid grid-cols-3 gap-1">
        <IconBtn label="Edit" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></IconBtn>
        <IconBtn label="Duplicate" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></IconBtn>
        <IconBtn label="Delete" onClick={onDelete} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
      </div>
    </div>
  );
}

function Avatar({ bot }) {
  if (bot.avatar_image_url) {
    return (
      <img
        src={bot.avatar_image_url}
        alt=""
        className="h-11 w-11 flex-shrink-0 rounded-xl object-cover border border-border"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/60 text-muted-foreground">
      <BotIcon className="h-5 w-5" />
    </div>
  );
}

function IconBtn({ children, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`inline-flex h-9 items-center justify-center rounded-lg border border-border bg-secondary/40 hover:bg-accent ${danger ? 'text-destructive hover:bg-destructive/10' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {children}
    </button>
  );
}