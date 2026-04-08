import { Send, Zap } from 'lucide-react';

export default function InputBar({ input, setInput, onSend, loading, mode, onToggleCommands, showCommands }) {
  const placeholders = {
    chat: 'Ask Jackie anything...',
    code: 'Describe what to build or paste code to refine...',
    visual: 'Describe a layout, flow or system...',
    builder: 'What system should we build?',
  };

  return (
    <div className="fixed bottom-16 left-0 right-0 px-4 pb-2 bg-background/95 backdrop-blur border-t border-border z-20">
      <div className="max-w-md mx-auto flex items-end gap-2 pt-2">
        <button onClick={onToggleCommands}
          className={`flex-shrink-0 rounded-2xl p-2.5 border transition-all ${showCommands ? 'bg-primary/10 text-primary border-primary/30' : 'bg-secondary text-muted-foreground border-border'}`}>
          <Zap className="w-4 h-4" />
        </button>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={placeholders[mode]}
          rows={1}
          className="flex-1 bg-secondary border border-border rounded-2xl px-4 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground resize-none max-h-28"
        />
        <button onClick={onSend} disabled={!input?.trim() || loading}
          className="bg-primary text-primary-foreground rounded-2xl p-2.5 flex-shrink-0 disabled:opacity-40 transition-opacity">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}