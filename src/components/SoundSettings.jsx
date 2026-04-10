import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Vibrate, Play, Zap } from 'lucide-react';
import { getSoundPrefs, saveSoundPrefs, playSound, SOUND_TYPES, SOUND_PACKS, VIBRATE } from '../lib/soundEngine';

export default function SoundSettings() {
  const [prefs, setPrefs] = useState(getSoundPrefs);

  const update = (key, val) => {
    const next = { ...prefs, [key]: val };
    setPrefs(next);
    saveSoundPrefs(next);
  };

  const preview = (type) => {
    if (prefs.enabled) playSound(type);
    VIBRATE[type]?.();
  };

  return (
    <div className="space-y-4">
      {/* Master toggle */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-3">
          {prefs.enabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
          <div>
            <p className="text-sm font-medium">Sound Effects</p>
            <p className="text-[10px] text-muted-foreground">UI interaction audio</p>
          </div>
        </div>
        <button onClick={() => update('enabled', !prefs.enabled)}
          className={`w-11 h-6 rounded-full transition-colors relative ${prefs.enabled ? 'bg-primary' : 'bg-secondary border border-border'}`}>
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${prefs.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Vibration toggle */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-3">
          <Vibrate className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Haptic Feedback</p>
            <p className="text-[10px] text-muted-foreground">Vibration on interactions</p>
          </div>
        </div>
        <button onClick={() => update('vibration', !prefs.vibration)}
          className={`w-11 h-6 rounded-full transition-colors relative ${prefs.vibration ? 'bg-primary' : 'bg-secondary border border-border'}`}>
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${prefs.vibration ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Volume */}
      <div className="px-4 py-3 bg-card border border-border rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Volume</span>
          <span className="text-xs font-mono text-muted-foreground">{Math.round(prefs.volume * 100)}%</span>
        </div>
        <input type="range" min={0} max={1} step={0.05} value={prefs.volume}
          onChange={e => update('volume', parseFloat(e.target.value))}
          disabled={!prefs.enabled}
          className="w-full accent-primary h-1.5 rounded-full disabled:opacity-40" />
      </div>

      {/* Sound Pack */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider px-1">Sound Pack</p>
        {Object.entries(SOUND_PACKS).map(([key, pack]) => (
          <button key={key} onClick={() => { update('pack', key); setTimeout(() => playSound('click'), 50); }}
            disabled={!prefs.enabled}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all disabled:opacity-40 ${prefs.pack === key ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'}`}>
            <div className="text-left">
              <p className="text-sm font-medium">{pack.label}</p>
              <p className="text-[10px] text-muted-foreground">{pack.desc}</p>
            </div>
            {prefs.pack === key && <Zap className="w-3.5 h-3.5 text-primary" />}
          </button>
        ))}
      </div>

      {/* Preview sounds */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider px-1">Preview Sounds</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(SOUND_TYPES).map(([type, info]) => (
            <button key={type} onClick={() => preview(type)}
              disabled={!prefs.enabled}
              className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-xl hover:border-primary/40 transition-all disabled:opacity-40 text-left">
              <Play className="w-3 h-3 text-primary flex-shrink-0" />
              <div>
                <p className="text-xs font-medium">{info.label}</p>
                <p className="text-[9px] text-muted-foreground">{info.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}