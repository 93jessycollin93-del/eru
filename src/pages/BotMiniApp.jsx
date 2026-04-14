import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bot, ExternalLink, Send } from 'lucide-react';

export default function BotMiniApp() {
  const [bot, setBot] = useState(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);

  const botId = useMemo(() => new URLSearchParams(window.location.search).get('bot'), []);

  useEffect(() => {
    if (!botId) return;
    base44.entities.UserBot.filter({ id: botId }, '-created_date', 1)
      .then((rows) => setBot(rows?.[0] || null));
  }, [botId]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', content: input }]);
    setMessages((prev) => [...prev, { role: 'assistant', content: bot?.greeting_message || bot?.description || 'Bot is ready.' }]);
    setInput('');
  };

  if (!bot) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 pb-24 flex items-center justify-center">
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm font-semibold text-foreground">Mini-app bot not found</p>
          <p className="mt-1 text-xs text-muted-foreground">Use a deployed bot link from the AI Lab deployment pipeline.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-4 pb-24 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-foreground truncate">{bot.name}</h1>
            <p className="text-xs text-muted-foreground line-clamp-2">{bot.description || 'Telegram mini-app deployment'}</p>
          </div>
          <a href="/ailab" className="inline-flex items-center gap-1 rounded-xl border border-border bg-secondary px-3 py-2 text-[11px] font-medium text-foreground">
            <ExternalLink className="w-3.5 h-3.5" /> AI Lab
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Mini-app preview</p>
        <div className="rounded-xl border border-border bg-background min-h-[320px] p-3 space-y-2">
          {messages.length === 0 ? (
            <div className="text-sm text-muted-foreground">{bot.greeting_message || 'Start chatting with this deployed bot.'}</div>
          ) : messages.map((message, index) => (
            <div key={index} className={`rounded-xl px-3 py-2 text-sm ${message.role === 'user' ? 'bg-primary text-primary-foreground ml-8' : 'bg-secondary text-foreground mr-8'}`}>
              {message.content}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Message this bot..."
            className="flex-1 rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none text-foreground"
          />
          <button onClick={sendMessage} className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}