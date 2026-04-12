import { useEffect, useMemo, useRef, useState } from 'react';
import { Tv2, X, Music, Film, Globe, Star, History, ChevronDown, ChevronRight, ArrowLeft, ArrowRight, RotateCw, ExternalLink, Search, Monitor } from 'lucide-react';

const QUICK_LINKS = [
  { label: 'YouTube', url: 'https://www.youtube.com/embed/jfKfPfyJRdk', icon: '▶️', category: 'Video' },
  { label: 'Lo-fi Radio', url: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1', icon: '🎵', category: 'Music' },
  { label: 'NASA Live', url: 'https://www.youtube.com/embed/21X5lGlDOfg?autoplay=1', icon: '🚀', category: 'Live' },
  { label: 'Crypto News', url: 'https://coindesk.com', icon: '📰', category: 'News' },
  { label: 'TradingView', url: 'https://www.tradingview.com/widgetembed/?symbol=BINANCE:BTCUSDT&interval=D&theme=dark', icon: '📈', category: 'Charts' },
  { label: 'Web Radio', url: 'https://www.radiooooo.com', icon: '📻', category: 'Music' },
];

const BOOKMARKS_KEY = 'screen-visualizer-bookmarks';
const HISTORY_KEY = 'screen-visualizer-history';
const ACTIVE_TAB_KEY = 'screen-visualizer-active-tab';
const TABS_KEY = 'screen-visualizer-tabs';
const DEFAULT_HOME = 'https://www.tradingview.com/widgetembed/?symbol=BINANCE:BTCUSDT&interval=D&theme=dark';

const normalizeUrl = (value) => {
  let target = (value || '').trim();
  if (!target) return '';

  const isDirectUrl = target.startsWith('http') || target.includes('.') || target.startsWith('localhost');
  if (!isDirectUrl) {
    return `https://www.google.com/search?q=${encodeURIComponent(target)}`;
  }

  if (!target.startsWith('http')) target = `https://${target}`;
  return target;
};

const getHostLabel = (value) => {
  try {
    return new URL(value).hostname.replace('www.', '');
  } catch {
    return 'New Tab';
  }
};

export default function ScreenVisualizer() {
  const [url, setUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState(DEFAULT_HOME);
  const [bookmarks, setBookmarks] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [bookmarksCollapsed, setBookmarksCollapsed] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [tabs, setTabs] = useState([{ id: 'home', url: DEFAULT_HOME, title: 'Markets' }]);
  const [activeTabId, setActiveTabId] = useState('home');
  const [reloadKey, setReloadKey] = useState(0);
  const inputRef = useRef(null);

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  useEffect(() => {
    const savedBookmarks = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
    const savedHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const savedTabs = JSON.parse(localStorage.getItem(TABS_KEY) || 'null');
    const savedActiveTab = localStorage.getItem(ACTIVE_TAB_KEY);

    setBookmarks(savedBookmarks);
    setHistoryItems(savedHistory);

    if (savedTabs?.length) {
      setTabs(savedTabs);
      setActiveTabId(savedActiveTab || savedTabs[0].id);
      setActiveUrl(savedTabs.find((tab) => tab.id === (savedActiveTab || savedTabs[0].id))?.url || DEFAULT_HOME);
      setUrl(savedTabs.find((tab) => tab.id === (savedActiveTab || savedTabs[0].id))?.url || DEFAULT_HOME);
    } else {
      setUrl(DEFAULT_HOME);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
  }, [activeTabId]);

  useEffect(() => {
    if (activeTab?.url) {
      setActiveUrl(activeTab.url);
      setUrl(activeTab.url);
    }
  }, [activeTab]);

  const persistBookmarks = (next) => {
    setBookmarks(next);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
  };

  const persistHistory = (next) => {
    setHistoryItems(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const updateActiveTab = (target) => {
    setTabs((prev) => prev.map((tab) => tab.id === activeTabId ? { ...tab, url: target, title: getHostLabel(target) } : tab));
  };

  const load = (u) => {
    const target = normalizeUrl(u || url);
    if (!target) return;
    setActiveUrl(target);
    setUrl(target);
    updateActiveTab(target);
    const nextHistory = [target, ...historyItems.filter((item) => item !== target)].slice(0, 8);
    persistHistory(nextHistory);
  };

  const clear = () => {
    setActiveUrl(null);
    setUrl('');
    updateActiveTab('');
  };

  const addBookmark = () => {
    const target = normalizeUrl(activeUrl || url);
    if (!target || bookmarks.includes(target)) return;
    persistBookmarks([target, ...bookmarks].slice(0, 8));
  };

  const removeBookmark = (target) => {
    persistBookmarks(bookmarks.filter((item) => item !== target));
  };

  const openNewTab = () => {
    const id = `tab-${Date.now()}`;
    const newTab = { id, url: DEFAULT_HOME, title: 'New Tab' };
    setTabs((prev) => [...prev, newTab].slice(-5));
    setActiveTabId(id);
    setActiveUrl(DEFAULT_HOME);
    setUrl(DEFAULT_HOME);
  };

  const closeTab = (id) => {
    if (tabs.length === 1) {
      clear();
      return;
    }
    const nextTabs = tabs.filter((tab) => tab.id !== id);
    setTabs(nextTabs);
    if (id === activeTabId) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  const refresh = () => setReloadKey((prev) => prev + 1);

  return (
    <div className="w-full">
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/60">
          <Tv2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <p className="text-xs font-semibold text-primary flex-1">Browser</p>
          <button onClick={openNewTab} className="rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground">
            + Tab
          </button>
          {activeUrl && (
            <button onClick={clear} className="p-1 rounded hover:bg-border transition-colors">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto px-3 py-2 border-b border-border bg-background/70">
          {tabs.map((tab) => (
            <div key={tab.id} className={`flex min-w-[130px] items-center gap-2 rounded-lg border px-2 py-1.5 ${tab.id === activeTabId ? 'border-primary bg-primary/10' : 'border-border bg-secondary/50'}`}>
              <button onClick={() => setActiveTabId(tab.id)} className="flex flex-1 items-center gap-2 truncate text-left">
                <Monitor className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate text-[10px] text-foreground">{tab.title}</span>
              </button>
              <button onClick={() => closeTab(tab.id)} className="p-0.5 rounded hover:bg-background">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
          <button onClick={() => inputRef.current?.focus()} className="rounded-lg border border-border bg-secondary p-2 text-muted-foreground">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => inputRef.current?.focus()} className="rounded-lg border border-border bg-secondary p-2 text-muted-foreground">
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={refresh} className="rounded-lg border border-border bg-secondary p-2 text-muted-foreground">
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
              placeholder="Search or enter website URL..."
              className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground font-mono"
            />
          </div>
          <button onClick={addBookmark}
            className="bg-secondary border border-border text-muted-foreground rounded-lg px-2.5 py-2 flex-shrink-0 text-xs font-semibold">
            <Star className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => window.open(activeUrl || normalizeUrl(url), '_blank', 'noopener,noreferrer')}
            className="bg-secondary border border-border text-muted-foreground rounded-lg px-2.5 py-2 flex-shrink-0 text-xs font-semibold">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => load()}
            className="bg-primary text-primary-foreground rounded-lg px-3 py-2 flex-shrink-0 text-xs font-semibold">
            Go
          </button>
        </div>

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

        <div className="grid gap-3 px-3 py-3 border-b border-border md:grid-cols-2">
          <div className="rounded-xl bg-secondary/50 border border-border p-3">
            <button onClick={() => setBookmarksCollapsed(!bookmarksCollapsed)} className="flex w-full items-center gap-2 mb-2 text-left">
              <Star className="w-3.5 h-3.5 text-primary" />
              <p className="text-[11px] font-semibold text-foreground flex-1">Bookmarks</p>
              {bookmarksCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            {!bookmarksCollapsed && (
              <div className="space-y-2">
                {bookmarks.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">No bookmarks yet.</p>
                ) : bookmarks.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <button onClick={() => load(item)} className="flex-1 truncate rounded-lg bg-background px-2 py-1.5 text-left text-[10px] text-foreground border border-border">
                      {item}
                    </button>
                    <button onClick={() => removeBookmark(item)} className="p-1 rounded hover:bg-background">
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-secondary/50 border border-border p-3">
            <button onClick={() => setHistoryCollapsed(!historyCollapsed)} className="flex w-full items-center gap-2 mb-2 text-left">
              <History className="w-3.5 h-3.5 text-primary" />
              <p className="text-[11px] font-semibold text-foreground flex-1">History</p>
              {historyCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            {!historyCollapsed && (
              <div className="space-y-2">
                {historyItems.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">No history yet.</p>
                ) : historyItems.map((item) => (
                  <button key={item} onClick={() => load(item)} className="w-full truncate rounded-lg bg-background px-2 py-1.5 text-left text-[10px] text-foreground border border-border">
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="relative bg-black h-[22rem] sm:h-[28rem]">
          {activeUrl ? (
            <iframe
              key={`${activeUrl}-${reloadKey}`}
              src={activeUrl}
              className="w-full h-full border-0 bg-white"
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              title="Screen Visualizer"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation allow-downloads"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground px-4 text-center">
              <div className="flex gap-4 mb-1">
                <Film className="w-5 h-5 opacity-40" />
                <Tv2 className="w-5 h-5 opacity-40" />
                <Music className="w-5 h-5 opacity-40" />
              </div>
              <p className="text-xs opacity-70">Use it like a mini browser: search, open tabs, save bookmarks, or launch a quick site.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}