import { useState } from 'react';
import { usePriceMap } from '../hooks/useCryptoPrices';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Lock, Unlock, Send, Download, Plus } from 'lucide-react';

const HOLDINGS = [
  { symbol: 'TON', amount: 150, locked: false, color: '#00e676' },
  { symbol: 'BTC', amount: 0.005, locked: true, color: '#f7931a' },
  { symbol: 'ETH', amount: 0.2, locked: false, color: '#627eea' },
  { symbol: 'STARS', amount: 5000, locked: false, color: '#ffeb3b' },
  { symbol: 'USDT', amount: 200, locked: false, color: '#26a17b' },
];

const TXS = [
  { id: 1, type: 'Swap', desc: 'TON → USDT', amount: '+200 USDT', status: 'completed', time: '2h ago' },
  { id: 2, type: 'Buy', desc: 'Bought TON', amount: '-50 USDT', status: 'completed', time: '1d ago' },
  { id: 3, type: 'NFT', desc: 'TON Punk #1337', amount: '-15.5 TON', status: 'completed', time: '3d ago' },
  { id: 4, type: 'Receive', desc: 'From 0xAB...3F', amount: '+0.1 ETH', status: 'completed', time: '5d ago' },
];

export default function Portfolio() {
  const prices = usePriceMap();
  const [locked, setLocked] = useState({});
  const [tab, setTab] = useState('assets');

  const holdings = HOLDINGS.map(h => ({
    ...h,
    value: (prices[h.symbol]?.price || 0) * h.amount,
    isLocked: locked[h.symbol] ?? h.locked,
  }));
  const total = holdings.reduce((s, h) => s + h.value, 0);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 py-4 text-center">
        <p className="text-xs text-muted-foreground font-mono uppercase">Total Balance</p>
        <p className="text-4xl font-mono font-semibold text-foreground mt-1">
          ${total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
        </p>
        <p className="text-green-400 text-sm mt-1">+$124.50 (2.4%) today</p>
        <div className="flex justify-center gap-4 mt-4">
          {[{icon:Send,label:'Send'},{icon:Download,label:'Receive'},{icon:Plus,label:'Buy'}].map(a => (
            <button key={a.label} className="flex flex-col items-center gap-1">
              <div className="bg-secondary border border-border rounded-full p-3">
                <a.icon className="w-4 h-4 text-primary"/>
              </div>
              <span className="text-xs text-muted-foreground">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex border-b border-border">
        {['assets','chart','history'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize ${tab===t?'text-primary border-b-2 border-primary':'text-muted-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'chart' && (
        <div className="px-4 py-4">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={holdings} dataKey="value" nameKey="symbol" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                {holdings.map((h, i) => <Cell key={i} fill={h.color}/>)}
              </Pie>
              <Tooltip contentStyle={{background:'hsl(230 22% 9%)',border:'1px solid hsl(230 18% 16%)',borderRadius:8,fontSize:12}}
                formatter={(v) => [`$${v.toFixed(2)}`, '']}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-2">
            {holdings.map(h => (
              <div key={h.symbol} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:h.color}}/>
                <span className="text-xs text-foreground">{h.symbol}</span>
                <span className="flex-1 text-xs text-muted-foreground text-right font-mono">{((h.value/total)*100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'assets' && (
        <div className="divide-y divide-border">
          {holdings.map(h => (
            <div key={h.symbol} className="flex items-center px-4 py-3 gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold font-mono flex-shrink-0"
                style={{background: `${h.color}20`, color: h.color, border: `1px solid ${h.color}40`}}>
                {h.symbol.slice(0,2)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{h.symbol}</p>
                <p className="text-xs text-muted-foreground font-mono">{h.amount} × ${(prices[h.symbol]?.price||0).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-medium">${h.value.toFixed(2)}</p>
                <p className={`text-xs font-mono ${(prices[h.symbol]?.change||0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(prices[h.symbol]?.change||0) >= 0 ? '+' : ''}{(prices[h.symbol]?.change||0).toFixed(2)}%
                </p>
              </div>
              <button onClick={() => setLocked(p => ({...p, [h.symbol]: !h.isLocked}))}
                className="ml-2 text-muted-foreground hover:text-primary transition-colors">
                {h.isLocked ? <Lock className="w-4 h-4 text-yellow-400"/> : <Unlock className="w-4 h-4"/>}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="divide-y divide-border">
          {TXS.map(tx => (
            <div key={tx.id} className="px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-mono">
                {tx.type.slice(0,1)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{tx.type}</p>
                <p className="text-xs text-muted-foreground">{tx.desc} · {tx.time}</p>
              </div>
              <span className={`text-sm font-mono ${tx.amount.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>{tx.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}