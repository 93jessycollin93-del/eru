import { usePriceMap } from '../../hooks/useCryptoPrices';
import { TrendingUp, TrendingDown } from 'lucide-react';

const HOLDINGS = [
  { symbol: 'TON', amount: 150 },
  { symbol: 'BTC', amount: 0.005 },
  { symbol: 'ETH', amount: 0.2 },
];

export default function PortfolioSummary() {
  const priceMap = usePriceMap();
  const total = HOLDINGS.reduce((sum, h) => {
    return sum + (priceMap[h.symbol]?.price || 0) * h.amount;
  }, 0);

  return (
    <div className="mx-4 mt-3 bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Total Portfolio</p>
      <p className="text-3xl font-semibold text-foreground mt-1 font-mono">
        ${total.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
      </p>
      <div className="flex items-center gap-1 mt-1">
        <TrendingUp className="w-3 h-3 text-green-400"/>
        <span className="text-green-400 text-xs">+2.4% today</span>
      </div>
      <div className="flex gap-3 mt-3 overflow-x-auto pb-1">
        {HOLDINGS.map(h => {
          const p = priceMap[h.symbol];
          if (!p) return null;
          return (
            <div key={h.symbol} className="bg-secondary rounded-lg px-3 py-2 flex-shrink-0 min-w-[90px]">
              <p className="text-xs text-muted-foreground">{h.symbol}</p>
              <p className="text-sm font-mono font-medium text-foreground">{h.amount}</p>
              <p className="text-xs text-muted-foreground">${(p.price * h.amount).toFixed(2)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}