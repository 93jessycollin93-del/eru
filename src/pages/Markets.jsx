import { useState, useEffect, useRef } from 'react';
import { useRealPrices } from '../hooks/useRealPrices';
import TickerBar from '../components/dashboard/TickerBar';
import { WifiOff, Loader2 } from 'lucide-react';
import { useFeatureTracking, trackFeatureInteraction } from '../hooks/useFeatureTracking';
import AssetComparisonDashboard from '../components/markets/AssetComparisonDashboard';

function PriceRow({ asset, onClick, selected }) {
  const prevRef = useRef(asset.price);
  const [flash, setFlash] = useState('');
  useEffect(() => {
    if (asset.price !== prevRef.current) {
      setFlash(asset.price > prevRef.current ? 'flash-green' : 'flash-red');
      const t = setTimeout(() => setFlash(''), 500);
      prevRef.current = asset.price;
      return () => clearTimeout(t);
    }
  }, [asset.price]);

  const price = asset.price ?? 0;
  const change = asset.change ?? 0;

  return (
    <div onClick={() => onClick(asset)}
      className={`flex items-center px-4 py-3 border-b border-border cursor-pointer transition-colors ${selected ? 'bg-secondary' : 'hover:bg-secondary/50'} ${flash}`}>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{asset.symbol}</p>
        <p className="text-xs text-muted-foreground font-mono">
          ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </p>
      </div>
      <div className="text-right">
        <span className={`text-sm font-mono font-medium ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export default function Markets() {
  useFeatureTracking('Markets');
  const { prices, status } = useRealPrices();
  const [selected, setSelected] = useState(null);
  const [interval, setIntervalLabel] = useState('1D');

  const handleAssetSelect = (asset) => {
    setSelected(asset);
    trackFeatureInteraction('Markets', 'click');
  };

  useEffect(() => {
    if (prices.length > 0 && !selected) setSelected(prices[0]);
  }, [prices]);

  if (status === 'loading') return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <TickerBar />
      <div className="flex-1 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <span className="text-sm text-muted-foreground">Fetching live market data…</span>
      </div>
    </div>
  );

  if (status === 'error') return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <TickerBar />
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <WifiOff className="w-10 h-10 text-muted-foreground/30" />
        <p className="font-semibold text-muted-foreground">No Market Data Available</p>
        <p className="text-xs text-muted-foreground/60">Could not reach CoinGecko API. Check your connection.</p>
      </div>
    </div>
  );

  const selPrice = selected?.price ?? 0;
  const selChange = selected?.change ?? 0;

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <TickerBar />
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold">Markets</h2>
        <span className="text-[10px] text-green-400 font-mono">● LIVE · CoinGecko</span>
      </div>

      {selected && (
        <div className="bg-card border-b border-border px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-semibold">{selected.symbol}</span>
            <span className="text-xl font-mono">
              ${selPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className={`text-sm ${selChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {selChange >= 0 ? '+' : ''}{selChange.toFixed(2)}%
            </span>
          </div>
          <div className="flex gap-2 mt-2">
            {['5M','1H','1D','1W'].map(l => (
              <button key={l} onClick={() => setIntervalLabel(l)}
                className={`text-xs px-2 py-1 rounded font-mono ${interval === l ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="h-40 mt-3 flex items-center justify-center bg-secondary/40 rounded-xl border border-border">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Historical chart requires a paid data API</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Current price shown above is live from CoinGecko</p>
            </div>
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="px-4 py-3 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">Top Movers</p>
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {prices.slice(0, 6).map(p => {
              const ch = p.change ?? 0;
              return (
                <div key={p.symbol} onClick={() => setSelected(p)}
                  className="rounded-lg p-2 cursor-pointer transition-opacity hover:opacity-80"
                  style={{ background: ch >= 0 ? `hsl(160 100% ${Math.min(45, 25 + Math.abs(ch) * 3)}% / 0.25)` : `hsl(350 100% ${Math.min(60, 25 + Math.abs(ch) * 3)}% / 0.25)` }}>
                  <p className="text-xs font-mono font-medium text-foreground">{p.symbol}</p>
                  <p className={`text-xs font-mono ${ch >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {ch >= 0 ? '+' : ''}{ch.toFixed(2)}%
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <AssetComparisonDashboard prices={prices} />
      </div>

      <div className="border-t border-border">
        {prices.map(p => (
          <PriceRow key={p.symbol} asset={p} onClick={handleAssetSelect} selected={selected?.symbol === p.symbol} />
        ))}
      </div>
    </div>
  );
}