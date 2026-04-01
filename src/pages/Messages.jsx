import { useState } from 'react';
import { Search, Plus, Circle, Send, Paperclip, Palette } from 'lucide-react';

const THREADS = [
  { id: 1, from: 'TON Support', subject: 'Transaction Confirmed', preview: 'Your swap of 50 TON → USDT has been completed...', time: '2m ago', unread: true, color: '#00e676' },
  { id: 2, from: 'NFT Marketplace', subject: 'Offer Received', preview: 'Someone made an offer on TON Punk #1337...', time: '1h ago', unread: true, color: '#7c4dff' },
  { id: 3, from: 'System', subject: 'Security Alert', preview: 'New login detected from a new device...', time: '3h ago', unread: false, color: '#ff5252' },
  { id: 4, from: 'Collectables', subject: 'Order Shipped', preview: 'Your Charizard PSA 9 is on its way...', time: '1d ago', unread: false, color: '#ffeb3b' },
];

const PALETTE = ['#00e676','#7c4dff','#ff5252','#ffeb3b','#2196f3','#ff9800','#e91e63'];

export default function Messages() {
  const [selected, setSelected] = useState(null);
  const [compose, setCompose] = useState(false);
  const [reply, setReply] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [color, setColor] = useState('#00e676');
  const [showPalette, setShowPalette] = useState(false);
  const [threads, setThreads] = useState(THREADS);

  if (compose) return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <button onClick={() => setCompose(false)} className="text-muted-foreground text-sm">Cancel</button>
        <h3 className="font-medium">New Message</h3>
        <button onClick={() => { setThreads(p => [{id:Date.now(),from:'You',subject,preview:body.slice(0,60),time:'just now',unread:false,color},...p]); setCompose(false); }}
          className="text-primary text-sm font-semibold">Send</button>
      </div>
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <button onClick={() => setShowPalette(p => !p)} className="rounded-full w-5 h-5 flex-shrink-0" style={{background:color}}/>
          {showPalette && (
            <div className="flex gap-1.5 flex-wrap">
              {PALETTE.map(c => <button key={c} onClick={() => {setColor(c);setShowPalette(false);}} className="w-5 h-5 rounded-full" style={{background:c}}/>)}
            </div>
          )}
          {!showPalette && <span className="text-xs text-muted-foreground">Label color</span>}
        </div>
        <div className="border-b border-border pb-3">
          <input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)}
            className="w-full bg-transparent text-foreground text-sm outline-none font-medium placeholder:text-muted-foreground"/>
        </div>
        <textarea placeholder="Write your message..." value={body} onChange={e => setBody(e.target.value)}
          className="w-full bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground min-h-[200px] resize-none"/>
      </div>
    </div>
  );

  if (selected) return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <button onClick={() => setSelected(null)} className="text-muted-foreground text-sm">← Back</button>
        <div className="flex-1">
          <p className="font-medium text-sm">{selected.from}</p>
          <p className="text-xs text-muted-foreground">{selected.subject}</p>
        </div>
      </div>
      <div className="flex-1 px-4 py-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{background:selected.color}}/>
            <span className="text-xs text-muted-foreground">{selected.time}</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{selected.preview} This is the full message content. All correspondence is encrypted and stored securely. Please do not share sensitive information in messages.</p>
        </div>
      </div>
      <div className="px-4 pb-4 flex items-center gap-2">
        <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply..."
          className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"/>
        <button className="bg-primary text-primary-foreground rounded-xl p-2.5">
          <Send className="w-4 h-4"/>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold">Messages</h2>
        <button onClick={() => setCompose(true)} className="bg-primary text-primary-foreground rounded-lg p-1.5">
          <Plus className="w-4 h-4"/>
        </button>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground"/>
          <input placeholder="Search messages..." className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"/>
        </div>
      </div>
      <div className="divide-y divide-border">
        {threads.map(t => (
          <div key={t.id} onClick={() => setSelected(t)} className="flex items-center px-4 py-3 gap-3 cursor-pointer hover:bg-secondary/40 transition-colors">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={{background:`${t.color}20`, color:t.color, border:`1px solid ${t.color}40`}}>
              {t.from.slice(0,1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className={`text-sm ${t.unread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>{t.from}</p>
                <p className="text-xs text-muted-foreground">{t.time}</p>
              </div>
              <p className={`text-xs truncate ${t.unread ? 'text-foreground' : 'text-muted-foreground'}`}>{t.subject}</p>
              <p className="text-xs text-muted-foreground truncate">{t.preview}</p>
            </div>
            {t.unread && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0"/>}
          </div>
        ))}
      </div>
    </div>
  );
}