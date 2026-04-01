import { useState, useRef, useEffect } from 'react';
import { useCryptoPrices } from '../hooks/useCryptoPrices';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import TickerBar from '../components/dashboard/TickerBar';

function generateChart(base, points = 50) {
  const data = [];
  let v = base;
  for (let i = 0; i < points; i++) {
    v = v * (1 + (Math.random() - 0.5) * 0.02);
    data.push({ t: i, p: parseFloat(v.toFixed(4)) });
  }
  return data;
}

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

  return (
    <div onClick={() => onClick(asset)}
      className={`flex items-center px-4 py-3 border-b border-border cursor-pointer transition-colors ${selected ? 'bg-secondary' : 'hover:bg-secondary/50'} ${flash}`}>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{asset.symbol}</p>
        <p className="text-xs text-muted-foreground font-mono">${asset.price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:4})}</p>
      </div>
      <div className="text-right">
        <span className={`text-sm font-mono font-medium ${asset.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {asset.change >= 0 ? '+' : ''}{asset.change.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export default function Markets() {
  const prices = useCryptoPrices();
  const [selected, setSelected] = useState(prices[0]);
  const [chartData] = useState(() => generateChart(selected?.base || 100));
  const [interval, setIntervalLabel] = useState('1H');

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <TickerBar />
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold">Markets</h2>
      </div>

      {selected && (
        <div className="bg-card border-b border-border px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-semibold">{selected.symbol}</span>
            <span className="text-xl font-mono">${selected.price.toLocaleString(undefined,{minimumFractionDigits:2})}</span>
            <span className={`text-sm ${selected.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {selected.change >= 0 ? '+' : ''}{selected.change.toFixed(2)}%
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
          <div className="h-40 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(160 100% 45%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(160 100% 45%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" hide/>
                <YAxis hide domain={['auto','auto']}/>
                <Tooltip
                  contentStyle={{background:'hsl(230 22% 9%)',border:'1px solid hsl(230 18% 16%)',borderRadius:8,fontSize:12}}
                  formatter={v => [`$${v}`, 'Price']}
                />
                <Area type="monotone" dataKey="p" stroke="hsl(160 100% 45%)" fill="url(#cg)" strokeWidth={2} dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-2">Top Movers</p>
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {prices.slice(0,6).map(p => (
            <div key={p.symbol} onClick={() => setSelected(p)} className="rounded-lg p-2 cursor-pointer transition-opacity hover:opacity-80"
              style={{background: p.change >= 0 ? `hsl(160 100% ${Math.min(45, 25 + Math.abs(p.change)*3)}% / 0.25)` : `hsl(350 100% ${Math.min(60, 25 + Math.abs(p.change)*3)}% / 0.25)`}}>
              <p className="text-xs font-mono font-medium text-foreground">{p.symbol}</p>
              <p className={`text-xs font-mono ${p.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {p.change >= 0 ? '+' : ''}{p.change.toFixed(2)}%
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border">
        {prices.map(p => (
          <PriceRow key={p.symbol} asset={p} onClick={setSelected} selected={selected?.symbol === p.symbol}/>
        ))}
      </div>
    </div>
  );
}