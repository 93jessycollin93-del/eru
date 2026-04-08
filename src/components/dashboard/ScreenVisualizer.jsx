import { useState, useRef } from 'react';
import { Tv2, Link, X, Play, Maximize2, Music, Film, Globe, ChevronRight } from 'lucide-react';

const QUICK_LINKS = [
  { label: 'YouTube', url: 'https://www.youtube.com/embed/jfKfPfyJRdk', icon: '▶️', category: 'Video' },
  { label: 'Lo-fi Radio', url: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1', icon: '🎵', category: 'Music' },
  { label: 'NASA Live', url: 'https://www.youtube.com/embed/21X5lGlDOfg?autoplay=1', icon: '🚀', category: 'Live' },
  { label: 'Crypto News', url: 'https://coindesk.com', icon: '📰', category: 'News' },
  { label: 'TradingView', url: 'https://www.tradingview.com/widgetembed/?symbol=BINANCE:BTCUSDT&interval=D&theme=dark', icon: '📈', category: 'Charts' },
  { label: 'Web Radio', url: 'https://www.radiooooo.com', icon: '📻', category: 'Music' },
];

export default function ScreenVisualizer() {
  const [url, setUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef(null);

  const load = (u) => {
    let target = u || url.trim();
    if (!target) return;
    if (!target.startsWith('http')) target = 'https://' + target;
    setActiveUrl(target);
    setUrl(target);
  };

  const clear = () => { setActiveUrl(null); setUrl(''); };

  return (
    <div className="w-full">
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/60">
          <Tv2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <p className="text-xs font-semibold text-primary flex-1">Screen</p>
          {activeUrl && (
            <button onClick={clear} className="p-1 rounded hover:bg-border transition-colors">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* URL bar — centered */}
        <div className="flex items-center justify-center gap-2 px-3 py-3 border-b border-border">
          <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Paste a URL, YouTube link, or website..."
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-xs outline-none text-foreground placeholder:text-muted-foreground font-mono"
          />
          <button onClick={() => load()}
            className="bg-primary text-primary-foreground rounded-lg px-3 py-2 flex-shrink-0 text-xs font-semibold">
            Go
          </button>
        </div>

        {/* Quick links — centered */}
        <div className="px-3 py-3 border-b border-border">
          <div className="flex justify-center gap-2 flex-wrap">
            {QUICK_LINKS.map(q => (
              <button key={q.label} onClick={() => load(q.url)}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-secondary hover:bg-border border border-transparent hover:border-primary/40 transition-all">
                <span className="text-lg leading-none">{q.icon}</span>
                <span className="text-[9px] text-muted-foreground whitespace-nowrap">{q.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Screen area — below controls */}
        <div className="relative bg-black h-52">
          {activeUrl ? (
            <iframe
              src={activeUrl}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              title="Screen Visualizer"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <div className="flex gap-4 mb-1">
                <Film className="w-5 h-5 opacity-40" />
                <Tv2 className="w-5 h-5 opacity-40" />
                <Music className="w-5 h-5 opacity-40" />
              </div>
              <p className="text-xs opacity-50">Pick a quick link or enter a URL above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}