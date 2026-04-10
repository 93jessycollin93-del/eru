import { useEffect, useRef } from 'react';
import { useRealPrices } from '../../hooks/useRealPrices';
import { WifiOff, Loader2 } from 'lucide-react';
import { useDashboardEvents } from '@/context/DashboardEventsContext';

export default function TickerBar() {
  const { prices, status } = useRealPrices();
  const { emit } = useDashboardEvents();
  const previousRef = useRef('');

  if (status === 'loading') {
    return (
      <div className="bg-card border-b border-border flex items-center gap-2 px-4 py-2 sticky top-0 z-50">
        <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
        <span className="text-xs text-muted-foreground font-mono">Fetching live prices…</span>
      </div>
    );
  }

  useEffect(() => {
    if (status !== 'live' || prices.length === 0) return;
    const signature = JSON.stringify(prices.map((item) => ({ symbol: item.symbol, price: item.price, change: item.change })));
    if (signature !== previousRef.current) {
      previousRef.current = signature;
      emit('market', 'priceChange', { prices });
    }
  }, [prices, status, emit]);

  if (status === 'error' || prices.length === 0) {
    return (
      <div className="bg-card border-b border-border flex items-center gap-2 px-4 py-2 sticky top-0 z-50">
        <WifiOff className="w-3 h-3 text-red-400" />
        <span className="text-xs text-red-400 font-mono">Market data unavailable — no data source connected</span>
      </div>
    );
  }

  const items = [...prices, ...prices];
  return (
    <div className="bg-card border-b border-border overflow-hidden sticky top-0 z-50">
      <div className="flex ticker-track whitespace-nowrap">
        {items.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono">
            <span className="text-muted-foreground">{p.symbol}</span>
            <span className="text-foreground font-medium">
              ${(p.price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={p.change >= 0 ? 'text-green-400' : 'text-red-400'}>
              {p.change >= 0 ? '▲' : '▼'} {Math.abs(p.change ?? 0).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}