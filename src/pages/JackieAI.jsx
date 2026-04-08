import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, RotateCcw, Bookmark, ChevronDown, Bot, Zap, Code, TrendingUp, Gamepad2, Lightbulb, PenLine } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

const TOOLS = [
  { id: 'general',  icon: Sparkles,   label: 'Assistant',  prompt: 'You are Jackie, a smart general assistant.' },
  { id: 'code',     icon: Code,       label: 'Code',       prompt: 'You are Jackie, an expert coding assistant. Format code in markdown code blocks.' },
  { id: 'market',   icon: TrendingUp, label: 'Markets',    prompt: 'You are Jackie, a knowledgeable crypto & financial markets educator. Explain concepts clearly. Never invent price data.' },
  { id: 'game',     icon: Gamepad2,   label: 'Gaming',     prompt: 'You are Jackie, a game guide and strategy expert.' },
  { id: 'strategy', icon: Zap,        label: 'Strategy',   prompt: 'You are Jackie, a strategic planning and productivity coach.' },
  { id: 'creative', icon: Lightbulb,  label: 'Creative',   prompt: 'You are Jackie, a creative writing and ideation expert.' },
];

const SUGGESTIONS = [
  'Explain DeFi in simple terms',
  'Help me plan a side project',
  'Write a Python web scraper',
  'What is a good trading strategy?',
];

export default function JackieAI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState(TOOLS[0]);
  const [tab, setTab] = useState('chat');
  const [saved, setSaved] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (tab === 'saved') loadSaved();
  }, [tab]);

  const loadSaved = async () => {
    setLoadingSaved(true);
    const items = await base44.entities.JackieSaved.list('-created_date', 20);
    setSaved(items);
    setLoadingSaved(false);
  };

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    const history = [...messages, userMsg].map(m => `${m.role === 'user' ? 'User' : 'Jackie'}: ${m.content}`).join('\n');
    const fullPrompt = `${activeTool.prompt}\n\nConversation:\n${history}\n\nJackie:`;
    const response = await base44.integrations.Core.InvokeLLM({ prompt: fullPrompt });
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  const saveMessage = async (content) => {
    const title = content.slice(0, 50);
    await base44.entities.JackieSaved.create({ title, content, tag: activeTool.id });
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">Jackie AI</p>
            <p className="text-[10px] text-primary mt-0.5">● Online</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTab(tab === 'chat' ? 'saved' : 'chat')}
            className="text-xs text-muted-foreground px-2 py-1 rounded-lg bg-secondary border border-border">
            {tab === 'chat' ? <><Bookmark className="w-3 h-3 inline mr-1" />Saved</> : <><Bot className="w-3 h-3 inline mr-1" />Chat</>}
          </button>
          {tab === 'chat' && (
            <button onClick={clearChat} className="text-xs text-muted-foreground px-2 py-1 rounded-lg bg-secondary border border-border">
              <RotateCcw className="w-3 h-3 inline mr-1" />New
            </button>
          )}
        </div>
      </div>

      {/* Tool selector */}
      {tab === 'chat' && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b border-border">
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setActiveTool(t)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${activeTool.id === t.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border'}`}>
              <t.icon className="w-3 h-3" />{t.label}
            </button>
          ))}
        </div>
      )}

      {/* CHAT TAB */}
      {tab === 'chat' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Hi, I'm Jackie</p>
                <p className="text-xs text-muted-foreground mt-1">Your AI assistant. Ask me anything.</p>
              </div>
              <div className="w-full space-y-2">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="w-full text-left px-4 py-2.5 rounded-xl bg-card border border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
              )}
              <div className={`max-w-[82%] ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground'} rounded-2xl px-4 py-2.5`}>
                {m.role === 'assistant' ? (
                  <ReactMarkdown className="text-sm prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    {m.content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-sm">{m.content}</p>
                )}
                {m.role === 'assistant' && (
                  <button onClick={() => saveMessage(m.content)} className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors">
                    <Bookmark className="w-2.5 h-2.5" /> Save
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3 h-3 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* SAVED TAB */}
      {tab === 'saved' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loadingSaved ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : saved.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Bookmark className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No saved outputs yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Tap Save on any Jackie response</p>
            </div>
          ) : saved.map(s => (
            <div key={s.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">{s.tag || 'general'}</p>
                <button onClick={async () => { await base44.entities.JackieSaved.delete(s.id); loadSaved(); }}
                  className="text-xs text-destructive">×</button>
              </div>
              <p className="text-sm mt-1 text-foreground leading-relaxed line-clamp-4">{s.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      {tab === 'chat' && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 bg-background/95 backdrop-blur border-t border-border">
          <div className="max-w-md mx-auto flex items-end gap-2 pt-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask Jackie anything..."
              rows={1}
              className="flex-1 bg-secondary border border-border rounded-2xl px-4 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground resize-none max-h-28"
            />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              className="bg-primary text-primary-foreground rounded-2xl p-2.5 flex-shrink-0 disabled:opacity-40 transition-opacity">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}