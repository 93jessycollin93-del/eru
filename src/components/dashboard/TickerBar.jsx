import { useCryptoPrices } from '../../hooks/useCryptoPrices';

export default function TickerBar() {
  const prices = useCryptoPrices();
  const items = [...prices, ...prices];
  return (
    <div className="bg-card border-b border-border overflow-hidden sticky top-0 z-50">
      <div className="flex ticker-track whitespace-nowrap">
        {items.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono">
            <span className="text-muted-foreground">{p.symbol}</span>
            <span className="text-foreground font-medium">${p.price.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}</span>
            <span className={p.change >= 0 ? 'text-green-400' : 'text-red-400'}>
              {p.change >= 0 ? '▲' : '▼'} {Math.abs(p.change).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}