import { Bot, Copy, Trash2 } from 'lucide-react';

export default function BotFleetTable({ bots = [], selectedBotId, onSelectBot, onCloneBot, onDeleteBot }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Bot className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">Bot fleet</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Bot</th>
              <th className="text-left px-4 py-3 font-medium">Username</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Memory</th>
              <th className="text-left px-4 py-3 font-medium">Tools</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bots.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No Telegram bots yet.</td>
              </tr>
            ) : bots.map((bot) => (
              <tr key={bot.id} className={`border-t border-border ${selectedBotId === bot.id ? 'bg-primary/5' : ''}`}>
                <td className="px-4 py-3">
                  <button onClick={() => onSelectBot(bot.id)} className="text-left">
                    <p className="font-medium">{bot.name}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[180px]">{bot.greeting_message || 'No greeting set'}</p>
                  </button>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{bot.bot_username ? `@${bot.bot_username}` : '—'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-full text-[11px] bg-secondary text-foreground">{bot.status || 'draft'}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{bot.memory_enabled ? `${bot.memory_retention || 'medium'} · ${bot.memory_message_limit || 20}` : 'Off'}</td>
                <td className="px-4 py-3 text-muted-foreground">{(bot.tool_modules || []).length}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => onCloneBot(bot)} className="p-2 rounded-lg bg-secondary border border-border text-muted-foreground">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDeleteBot(bot.id)} className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}