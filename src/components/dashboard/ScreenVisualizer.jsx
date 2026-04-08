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
    <div className={`transition-all duration-300 ${expanded ? 'fixed inset-x-0 bottom-16 z-50 mx-2' : 'w-full'}`}>
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/60">
          <Tv2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <p className="text-xs font-semibold text-primary flex-1">Screen</p>
          <button onClick={() => setExpanded(p => !p)}
            className="p-1 rounded hover:bg-border transition-colors">
            <Maximize2 className="w-3 h-3 text-muted-foreground" />
          </button>
          {activeUrl && (
            <button onClick={clear} className="p-1 rounded hover:bg-border transition-colors">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* URL bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Paste a URL, YouTube link, or website..."
            className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground font-mono"
          />
          <button onClick={() => load()}
            className="bg-primary text-primary-foreground rounded-lg p-1 flex-shrink-0">
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Screen area */}
        <div className={`relative bg-black ${expanded ? 'h-64' : 'h-40'} transition-all duration-300`}>
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
              <p className="text-xs opacity-50">Enter a URL or pick a quick link below</p>
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="px-3 py-2.5 border-t border-border">
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2">Quick Links</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {QUICK_LINKS.map(q => (
              <button key={q.label} onClick={() => load(q.url)}
                className="flex-shrink-0 flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl bg-secondary hover:bg-border hover:border-primary/40 border border-transparent transition-all">
                <span className="text-base leading-none">{q.icon}</span>
                <span className="text-[9px] text-muted-foreground whitespace-nowrap">{q.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}