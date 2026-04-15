import { Network } from 'lucide-react';

export default function TelegramSwarmConfigPanel({ bots, form, setForm }) {
  const routerBotId = form.router_bot_id || '';
  const specialistBotIds = form.specialist_bot_ids || [];

  const toggleSpecialist = (botId) => {
    setForm((prev) => ({
      ...prev,
      specialist_bot_ids: (prev.specialist_bot_ids || []).includes(botId)
        ? prev.specialist_bot_ids.filter((id) => id !== botId)
        : [...(prev.specialist_bot_ids || []), botId]
    }));
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Network className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Internal agent swarm</p>
      </div>
      <p className="text-[11px] text-muted-foreground">One Telegram bot acts as the front door while routing work to internal specialist bots.</p>

      <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground">
        <input
          type="checkbox"
          checked={!!form.swarm_enabled}
          onChange={(e) => setForm((prev) => ({ ...prev, swarm_enabled: e.target.checked }))}
          className="accent-primary"
        />
        Enable swarm routing for this Telegram bot
      </label>

      {form.swarm_enabled && (
        <>
          <select
            value={routerBotId}
            onChange={(e) => setForm((prev) => ({ ...prev, router_bot_id: e.target.value }))}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none"
          >
            <option value="">Choose router bot</option>
            {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}
          </select>

          <textarea
            value={form.swarm_goal_template || ''}
            onChange={(e) => setForm((prev) => ({ ...prev, swarm_goal_template: e.target.value }))}
            placeholder="Optional router instructions for Telegram requests"
            className="w-full min-h-[80px] rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground outline-none resize-none"
          />

          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">Specialist bots</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {bots.filter((bot) => bot.id !== routerBotId).map((bot) => {
                const active = specialistBotIds.includes(bot.id);
                return (
                  <button
                    key={bot.id}
                    onClick={() => toggleSpecialist(bot.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs transition-all ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground'}`}
                  >
                    <p className="font-semibold truncate">{bot.name}</p>
                    <p className={`mt-1 text-[11px] ${active ? 'text-primary/80' : 'text-muted-foreground'}`}>{bot.role}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}