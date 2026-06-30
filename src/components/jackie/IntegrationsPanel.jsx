import { Database, KeyRound, Bot, Sparkles, ArrowRight } from 'lucide-react';

function IntegrationStat({ title, value, hint, icon: Icon, actionLabel, onClick }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
        </div>
        <div className="h-9 w-9 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-semibold text-foreground">{value}</span>
        {onClick && (
          <button onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">
            {actionLabel} <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsPanel({ userBots = [], apiKeyCount = 0, apiKeyCapabilities = {}, onNavigate }) {
  const unlocked = [
    apiKeyCapabilities.webSearch ? 'Web search' : null,
    apiKeyCapabilities.code ? 'Code engine' : null,
    apiKeyCapabilities.squad ? 'Squad pipelines' : null,
  ].filter(Boolean);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Jackie Connections</h3>
        <p className="text-xs text-muted-foreground mt-1">Live status from your bot and API-key surfaces inside ERU.</p>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <IntegrationStat
          title="AI Lab bots"
          value={userBots.length}
          hint={userBots.length > 0 ? 'Bots are ready for training and deployment.' : 'Create a bot to unlock Foundry and AI Lab workflows.'}
          icon={Bot}
          actionLabel="Open AI Lab"
          onClick={() => onNavigate?.('/ailab')}
        />
        <IntegrationStat
          title="Active API keys"
          value={apiKeyCount}
          hint={apiKeyCount > 0 ? 'Keys are available for bot-linked access control.' : 'Create a key to unlock external workflows and connected access.'}
          icon={KeyRound}
          actionLabel="Manage keys"
          onClick={() => onNavigate?.('/apikeys')}
        />
      </div>

      <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <p className="text-xs font-semibold text-foreground">Capability unlocks</p>
        </div>
        {unlocked.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {unlocked.map((item) => (
              <span key={item} className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{item}</span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No premium Jackie capabilities are unlocked yet. Start with API Keys to add web, code, or squad permissions.</p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-primary/5 p-3 flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-primary mt-0.5" />
        <p className="text-[11px] text-muted-foreground">Jackie now reads real ERU setup status instead of showing a static integrations list.</p>
      </div>
    </div>
  );
}
