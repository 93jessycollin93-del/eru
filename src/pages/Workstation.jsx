import { useState } from 'react';
import { Plus, X, Move, Palette, Monitor, Sliders, Save, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import AnimatedBackground from '../components/AnimatedBackground';

const WIDGETS = [
  { id: 'portfolio', label: 'Portfolio Summary', color: '#00e676' },
  { id: 'markets', label: 'Live Markets', color: '#2196f3' },
  { id: 'ideas', label: 'My Ideas', color: '#7c4dff' },
  { id: 'thinkers', label: 'Thinkers Club', color: '#ff9800' },
  { id: 'nfts', label: 'NFT Gallery', color: '#e91e63' },
  { id: 'ads', label: 'My Ads', color: '#ffeb3b' },
];

const BG_OPTIONS = [
  { id: 'none', label: 'None' },
  { id: 'matrix', label: 'Matrix Rain' },
  { id: 'particles', label: 'Neural Net' },
  { id: 'nebula', label: 'Nebula Drift' },
];

export default function Workstation() {
  const { theme, setTheme, bg, setBg, bgOpacity, setBgOpacity, uiScale, setUiScale, themes } = useTheme();
  const [activeWidgets, setActiveWidgets] = useState(['portfolio', 'markets', 'ideas']);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState('theme');

  const toggleWidget = (id) => {
    setActiveWidgets(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 relative">
      <AnimatedBackground type={bg} opacity={bgOpacity} />
      <div className="relative z-10">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Workstation</h2>
            <p className="text-xs text-muted-foreground">Customize your experience</p>
          </div>
          <button onClick={handleSave}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${saved ? 'bg-primary/20 text-primary' : 'bg-primary text-primary-foreground'}`}>
            {saved ? <><Check className="w-3.5 h-3.5" /> Saved!</> : <><Save className="w-3.5 h-3.5" /> Save</>}
          </button>
        </div>

        {/* Tab Nav */}
        <div className="flex border-b border-border">
          {[{id:'theme',icon:Palette,label:'Theme'},{id:'background',icon:Monitor,label:'Background'},{id:'layout',icon:Sliders,label:'Layout'}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${tab===t.id?'text-primary border-b-2 border-primary':'text-muted-foreground'}`}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>

        <div className="px-4 py-4 space-y-4">
          {tab === 'theme' && (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Color Theme</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(themes).map(([key, val]) => (
                  <button key={key} onClick={() => setTheme(key)}
                    className={`relative rounded-xl border p-3 text-left transition-all ${theme===key?'border-primary bg-primary/10':'border-border bg-card hover:bg-secondary/40'}`}>
                    <div className="w-6 h-6 rounded-full mb-2" style={{ background: `hsl(${val['--primary']})` }} />
                    <p className="text-sm font-medium">{val.label}</p>
                    {theme === key && <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === 'background' && (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Animated Background</p>
              <div className="grid grid-cols-2 gap-2">
                {BG_OPTIONS.map(opt => (
                  <button key={opt.id} onClick={() => setBg(opt.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${bg===opt.id?'border-primary bg-primary/10':'border-border bg-card hover:bg-secondary/40'}`}>
                    <p className="text-sm font-medium">{opt.label}</p>
                    {bg === opt.id && <div className="text-xs text-primary mt-1">Active ✓</div>}
                  </button>
                ))}
              </div>
              {bg !== 'none' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Opacity</p>
                    <span className="text-xs text-primary font-mono">{Math.round(bgOpacity * 100)}%</span>
                  </div>
                  <input type="range" min="0.1" max="1" step="0.05" value={bgOpacity}
                    onChange={e => setBgOpacity(parseFloat(e.target.value))}
                    className="w-full accent-primary" />
                </div>
              )}
            </>
          )}

          {tab === 'layout' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">UI Scale</p>
                  <span className="text-xs text-primary font-mono">{Math.round(uiScale * 100)}%</span>
                </div>
                <input type="range" min="0.8" max="1.3" step="0.05" value={uiScale}
                  onChange={e => setUiScale(parseFloat(e.target.value))}
                  className="w-full accent-primary" />
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-4">Dashboard Widgets</p>
              <div className="space-y-2">
                {WIDGETS.map(w => (
                  <div key={w.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: w.color }} />
                      <span className="text-sm">{w.label}</span>
                    </div>
                    <button onClick={() => toggleWidget(w.id)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${activeWidgets.includes(w.id) ? 'bg-primary' : 'bg-secondary'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${activeWidgets.includes(w.id) ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}