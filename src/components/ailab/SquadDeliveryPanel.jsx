import { base44 } from '@/api/base44Client';
import { BellRing, Slack, NotebookPen } from 'lucide-react';

const SLACK_CONNECTOR_ID = '69d36031ad616ab7e397c32c';
const NOTION_CONNECTOR_ID = '69d35dff4263aa71b212065f';

export default function SquadDeliveryPanel({ squad, onRefresh }) {
  const deliveryTargets = squad.delivery_targets || [];

  const updateTargets = async (target) => {
    const nextTargets = deliveryTargets.includes(target)
      ? deliveryTargets.filter((item) => item !== target)
      : [...deliveryTargets, target];

    await base44.entities.BotSquad.update(squad.id, {
      delivery_enabled: nextTargets.length > 0,
      delivery_targets: nextTargets,
      delivery_condition: 'manual_toggle',
    });
    onRefresh?.();
  };

  const connectTarget = async (connectorId) => {
    const authed = await base44.auth.isAuthenticated();
    if (!authed) {
      base44.auth.redirectToLogin();
      return;
    }
    const url = await base44.connectors.connectAppUser(connectorId);
    const popup = window.open(url, '_blank');
    const timer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        onRefresh?.();
      }
    }, 500);
  };

  return (
    <div className="rounded-xl border border-border bg-background p-3 space-y-3">
      <div className="flex items-center gap-2">
        <BellRing className="w-4 h-4 text-primary" />
        <div>
          <p className="text-xs font-semibold text-foreground">Delivery automation</p>
          <p className="text-[10px] text-muted-foreground">Manual toggle delivery after pipeline completion.</p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <button onClick={() => updateTargets('slack')} className={`rounded-xl border p-3 text-left ${deliveryTargets.includes('slack') ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
          <div className="flex items-center gap-2"><Slack className="w-4 h-4 text-primary" /><p className="text-xs font-semibold text-foreground">Slack delivery</p></div>
          <p className="mt-1 text-[10px] text-muted-foreground">Send final pipeline output to Slack.</p>
        </button>
        <button onClick={() => updateTargets('notion')} className={`rounded-xl border p-3 text-left ${deliveryTargets.includes('notion') ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
          <div className="flex items-center gap-2"><NotebookPen className="w-4 h-4 text-primary" /><p className="text-xs font-semibold text-foreground">Notion delivery</p></div>
          <p className="mt-1 text-[10px] text-muted-foreground">Create a page entry in Notion.</p>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => connectTarget(SLACK_CONNECTOR_ID)} className="rounded-xl border border-border px-3 py-2 text-[11px] text-muted-foreground">Connect Slack</button>
        <button onClick={() => connectTarget(NOTION_CONNECTOR_ID)} className="rounded-xl border border-border px-3 py-2 text-[11px] text-muted-foreground">Connect Notion</button>
      </div>
    </div>
  );
}