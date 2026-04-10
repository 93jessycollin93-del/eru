import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bot, Pin, Zap, Plus, Check, Activity, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import NewsFeedWidget from './NewsFeedWidget';
import AIInsightsWidget from './AIInsightsWidget';

const QUICK_ACTIONS = [
  { label: 'AI Lab', to: '/ailab' },
  { label: 'Markets', to: '/markets' },
  { label: 'Trade', to: '/trade' },
  { label: 'Portfolio', to: '/portfolio' },
];

const DEFAULT_METRICS = ['BTC', 'ETH', 'SOL'];

function SectionHeader({ icon: HeaderIcon, title, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <HeaderIcon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {action}
    </div>
  );
}

function BotStatusWidget() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadBots = async () => {
    setLoading(true);
    const data = await base44.entities.UserBot.list('-updated_date', 8);
    setBots(data || []);
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    loadBots();
    const unsubscribe = base44.entities.UserBot.subscribe((event) => {
      if (event.type === 'create') {
        setBots((prev) => [event.data, ...prev].slice(0, 8));
      }
      if (event.type === 'update') {
        setBots((prev) => prev.map((item) => item.id === event.id ? event.data : item));
      }
      if (event.type === 'delete') {
        setBots((prev) => prev.filter((item) => item.id !== event.id));
      }
      setLastUpdated(new Date());
    });
    return unsubscribe;
  }, []);

  const toggleStatus = async (bot) => {
    const nextStatus = bot.status === 'active' ? 'inactive' : 'active';
    await base44.entities.UserBot.update(bot.id, { status: nextStatus });
    setBots((prev) => prev.map((item) => item.id === bot.id ? { ...item, status: nextStatus } : item));
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <SectionHeader
        icon={Bot}
        title="Bot Status"
        action={<button onClick={loadBots} className="p-1 rounded hover:bg-secondary"><RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} /></button>}
      />
      {lastUpdated && <p className="text-[10px] text-muted-foreground mb-3">Live · Updated {lastUpdated.toLocaleTimeString()}</p>}
      <div className="space-y-2">
        {bots.length === 0 ? (
          <p className="text-xs text-muted-foreground">No bots found.</p>
        ) : bots.map((bot) => (
          <div key={bot.id} className="flex items-center gap-3 rounded-xl bg-secondary/50 border border-border px-3 py-2.5">
            <div className={`w-2 h-2 rounded-full ${bot.status === 'active' ? 'bg-green-400' : 'bg-muted-foreground'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{bot.name}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{bot.role || 'bot'} · {bot.status || 'inactive'}</p>
            </div>
            <button
              onClick={() => toggleStatus(bot)}
              className={`text-[10px] px-2.5 py-1 rounded-lg border ${bot.status === 'active' ? 'border-green-400/20 bg-green-400/10 text-green-400' : 'border-border bg-card text-muted-foreground'}`}
            >
              {bot.status === 'active' ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketPinsWidget({ prices }) {
  const [pinnedMetrics, setPinnedMetrics] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('dashboard_pinned_market_metrics') || 'null');
      return stored?.length ? stored : DEFAULT_METRICS;
    } catch {
      return DEFAULT_METRICS;
    }
  });

  const savePins = (next) => {
    setPinnedMetrics(next);
    localStorage.setItem('dashboard_pinned_market_metrics', JSON.stringify(next));
  };

  const available = useMemo(() => prices.filter((item) => item?.symbol), [prices]);
  const visible = available.filter((item) => pinnedMetrics.includes(item.symbol));

  const toggleMetric = (symbol) => {
    const next = pinnedMetrics.includes(symbol)
      ? pinnedMetrics.filter((item) => item !== symbol)
      : [...pinnedMetrics, symbol].slice(-4);
    savePins(next);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <SectionHeader icon={Pin} title="Pinned Market Metrics" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground sm:col-span-3">Pin live metrics below.</p>
        ) : visible.map((item) => (
          <div key={item.symbol} className="rounded-xl bg-secondary/50 border border-border px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">{item.symbol}</p>
              <span className={`text-[10px] ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change || 0).toFixed(2)}%
              </span>
            </div>
            <p className="text-sm font-mono mt-1">${(item.price || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {available.slice(0, 8).map((item) => {
          const active = pinnedMetrics.includes(item.symbol);
          return (
            <button
              key={item.symbol}
              onClick={() => toggleMetric(item.symbol)}
              className={`text-[10px] px-2.5 py-1 rounded-full border ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground'}`}
            >
              {active ? <Check className="w-3 h-3 inline mr-1" /> : <Plus className="w-3 h-3 inline mr-1" />}
              {item.symbol}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DashboardActionsWidget() {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <SectionHeader icon={Zap} title="Quick Actions" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="rounded-xl border border-border bg-secondary/50 hover:border-primary/30 transition-colors px-3 py-3 text-center"
          >
            <div className="flex items-center justify-center gap-1 text-primary mb-1">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs font-medium">{action.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function WidgetLibrary({ prices = [] }) {
  return (
    <div className="space-y-4">
      <BotStatusWidget />
      <MarketPinsWidget prices={prices} />
      <NewsFeedWidget />
      <AIInsightsWidget />
      <DashboardActionsWidget />
    </div>
  );
}