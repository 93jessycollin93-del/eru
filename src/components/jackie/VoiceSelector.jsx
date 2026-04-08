import { useState } from 'react';
import { ChevronDown, Mic } from 'lucide-react';

export const VOICES = [
  { id: 'default',  name: 'Jackie',   emoji: '🤖', desc: 'Balanced & smart',         style: 'Be clear, helpful, and direct.' },
  { id: 'sage',     name: 'Sage',     emoji: '🧘', desc: 'Wise & philosophical',      style: 'Be thoughtful, use analogies, speak with depth and wisdom.' },
  { id: 'hacker',   name: 'Hacker',   emoji: '💻', desc: 'Technical & blunt',         style: 'Be extremely technical, terse, use code first. No fluff.' },
  { id: 'mentor',   name: 'Mentor',   emoji: '🎓', desc: 'Warm & encouraging',        style: 'Be warm, encouraging, break things down patiently like a great teacher.' },
  { id: 'analyst',  name: 'Analyst',  emoji: '📊', desc: 'Data-driven & precise',     style: 'Be data-driven. Use structure, bullet points, and logical frameworks.' },
  { id: 'creator',  name: 'Creator',  emoji: '✨', desc: 'Creative & energetic',      style: 'Be imaginative, enthusiastic, and push creative boundaries.' },
  { id: 'strategist', name: 'Strat', emoji: '♟️', desc: 'Strategic & calculated',    style: 'Think long-term. Break every answer into strategy, tactics, and execution.' },
];

export default function VoiceSelector({ voice, setVoice }) {
  const [open, setOpen] = useState(false);
  const current = VOICES.find(v => v.id === voice) || VOICES[0];

  return (
    <div className="relative">
      <button onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-secondary border border-border text-xs text-muted-foreground hover:border-primary/30 hover:text-primary transition-all">
        <span>{current.emoji}</span>
        <span className="font-medium">{current.name}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          {VOICES.map(v => (
            <button key={v.id} onClick={() => { setVoice(v.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary ${voice === v.id ? 'bg-primary/10' : ''}`}>
              <span className="text-base leading-none">{v.emoji}</span>
              <div>
                <p className={`text-xs font-semibold ${voice === v.id ? 'text-primary' : 'text-foreground'}`}>{v.name}</p>
                <p className="text-[10px] text-muted-foreground">{v.desc}</p>
              </div>
              {voice === v.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}