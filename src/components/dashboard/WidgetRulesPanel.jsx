import { useState } from 'react';
import { Plus, Sparkles, Zap } from 'lucide-react';
import { useDashboardEvents } from './DashboardEventContext';

const SOURCE_OPTIONS = [
  { value: 'market', label: 'Market Data' },
  { value: 'analytics', label: 'Analytics' },
];

const TARGET_OPTIONS = [
  { value: 'portfolio', label: 'Portfolio Summary', action: 'refresh_summary' },
  { value: 'alerts', label: 'Alert Manager', action: 'scan_alerts' },
  { value: 'analytics', label: 'Analytics Widget', action: 'refresh_recommendations' },
];

export default function WidgetRulesPanel() {
  const { rules, toggleRule, addRule, eventLog } = useDashboardEvents();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ source: 'market', condition: 'price_change', target: 'alerts' });

  const handleAdd = () => {
    const target = TARGET_OPTIONS.find((item) => item.value === form.target);
    addRule({ ...form, action: target?.action || 'refresh_summary' });
    setShowForm(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Widget Automations</h3>
        </div>
        <button onClick={() => setShowForm((prev) => !prev)} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20">
          <Plus className="w-3 h-3" /> Add Rule
        </button>
      </div>

      {showForm && (
        <div className="p-3 bg-secondary rounded-lg border border-border/50 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="px-2 py-2 bg-card border border-border rounded text-xs">
              {SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} className="px-2 py-2 bg-card border border-border rounded text-xs">
              <option value="price_change">Price Change</option>
              <option value="refresh">Refresh</option>
              <option value="insight_ready">Insight Ready</option>
            </select>
            <select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="px-2 py-2 bg-card border border-border rounded text-xs">
              {TARGET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <button onClick={handleAdd} className="w-full py-2 bg-primary text-primary-foreground rounded text-xs font-medium">Save Rule</button>
        </div>
      )}

      <div className="space-y-2">
        {rules.map((rule) => (
          <button key={rule.id} onClick={() => toggleRule(rule.id)} className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left ${rule.enabled ? 'bg-primary/5 border-primary/20' : 'bg-secondary/40 border-border/50'}`}>
            <div>
              <p className="text-xs font-medium">{rule.source} → {rule.target}</p>
              <p className="text-[10px] text-muted-foreground">When {rule.condition}, run {rule.action}</p>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded-full ${rule.enabled ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>{rule.enabled ? 'On' : 'Off'}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <p className="text-xs font-medium">Live Event Feed</p>
        </div>
        <div className="space-y-1">
          {eventLog.length === 0 ? <p className="text-[10px] text-muted-foreground">No widget events yet.</p> : eventLog.slice(0, 4).map((item) => (
            <div key={item.id} className="text-[10px] text-muted-foreground bg-secondary/40 rounded px-2 py-1.5">
              {item.eventName}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}