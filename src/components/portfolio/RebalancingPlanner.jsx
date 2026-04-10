import { useMemo, useState } from 'react';
import { RefreshCcw, ArrowRightLeft } from 'lucide-react';

const DEFAULT_CURRENT = [
  { symbol: 'BTC', value: 35000 },
  { symbol: 'ETH', value: 30000 },
  { symbol: 'SOL', value: 20000 },
  { symbol: 'USDC', value: 15000 },
];

const DEFAULT_TARGETS = [
  { symbol: 'BTC', target: 35 },
  { symbol: 'ETH', target: 30 },
  { symbol: 'SOL', target: 20 },
  { symbol: 'USDC', target: 15 },
];

export default function RebalancingPlanner() {
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [planned, setPlanned] = useState(false);

  const plan = useMemo(() => {
    const totalValue = DEFAULT_CURRENT.reduce((sum, item) => sum + item.value, 0);
    const rows = DEFAULT_CURRENT.map((holding) => {
      const currentPct = totalValue ? (holding.value / totalValue) * 100 : 0;
      const targetPct = targets.find((item) => item.symbol === holding.symbol)?.target || 0;
      const targetValue = (targetPct / 100) * totalValue;
      const difference = targetValue - holding.value;
      return {
        ...holding,
        currentPct,
        targetPct,
        targetValue,
        difference,
        action: difference > 0 ? 'Buy' : difference < 0 ? 'Sell' : 'Hold',
      };
    });

    const sells = rows.filter((item) => item.difference < 0).map((item) => ({ ...item }));
    const buys = rows.filter((item) => item.difference > 0).map((item) => ({ ...item }));
    const steps = [];

    sells.forEach((sell) => {
      let remaining = Math.abs(sell.difference);
      buys.forEach((buy) => {
        if (remaining <= 0 || buy.difference <= 0) return;
        const amount = Math.min(remaining, buy.difference);
        if (amount > 0) {
          steps.push(`Swap about $${amount.toFixed(0)} from ${sell.symbol} into ${buy.symbol}`);
          buy.difference -= amount;
          remaining -= amount;
        }
      });
    });

    return { totalValue, rows, steps };
  }, [targets]);

  const totalTarget = targets.reduce((sum, item) => sum + Number(item.target || 0), 0);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <RefreshCcw className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Rebalancing Planner</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {targets.map((item) => (
          <label key={item.symbol} className="bg-secondary rounded-lg border border-border px-3 py-2 space-y-1">
            <span className="text-[10px] text-muted-foreground">{item.symbol} target %</span>
            <input
              type="number"
              value={item.target}
              onChange={(e) => setTargets((prev) => prev.map((entry) => entry.symbol === item.symbol ? { ...entry, target: Number(e.target.value || 0) } : entry))}
              className="w-full bg-transparent text-sm outline-none text-foreground"
            />
          </label>
        ))}
      </div>

      <div className="bg-secondary rounded-xl p-3 border border-border/50 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground">Target total</p>
          <p className={`text-lg font-bold ${totalTarget === 100 ? 'text-primary' : 'text-red-400'}`}>{totalTarget}%</p>
        </div>
        <button
          onClick={() => setPlanned(true)}
          disabled={totalTarget !== 100}
          className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold disabled:opacity-40"
        >
          Generate one-click plan
        </button>
      </div>

      <div className="space-y-2">
        {plan.rows.map((item) => (
          <div key={item.symbol} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
            <div>
              <p className="text-xs font-medium">{item.symbol}</p>
              <p className="text-[10px] text-muted-foreground">Current {item.currentPct.toFixed(1)}% → Target {item.targetPct.toFixed(1)}%</p>
            </div>
            <p className={`text-xs font-semibold ${item.difference > 0 ? 'text-green-400' : item.difference < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
              {item.action} {Math.abs(item.difference).toFixed(0) > 0 ? `$${Math.abs(item.difference).toFixed(0)}` : ''}
            </p>
          </div>
        ))}
      </div>

      {planned && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-primary">Swap Plan</p>
          </div>
          <div className="space-y-1.5">
            {plan.steps.length > 0 ? plan.steps.map((step) => (
              <p key={step} className="text-xs text-foreground">• {step}</p>
            )) : <p className="text-xs text-muted-foreground">Your current holdings already match the target weights closely.</p>}
          </div>
        </div>
      )}
    </div>
  );
}