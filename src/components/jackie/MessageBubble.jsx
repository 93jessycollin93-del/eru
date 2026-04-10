import { useState } from 'react';
import { Bot, Bookmark, Copy, PenLine, Check, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function MessageBubble({ message, onSave, onRefine, onInject }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const isUser = message.role === 'user';

  const copyContent = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = () => {
    onSave(message.content);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const downloadContent = () => {
    const blob = new Blob([message.content || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jackie-output.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasCode = message.content?.includes('```');

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="w-3 h-3 text-primary" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground'} rounded-2xl px-4 py-2.5`}>
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <ReactMarkdown
            className="text-sm prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:bg-background [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-border [&_code]:text-primary/90 [&_code]:text-xs"
          >
            {message.content}
          </ReactMarkdown>
        )}
        {!isUser && (
          <div className="flex items-center gap-3 mt-2 pt-1.5 border-t border-border/50">
            <button onClick={copyContent} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors">
              {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={handleSave} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors">
              {saved ? <Check className="w-2.5 h-2.5" /> : <Bookmark className="w-2.5 h-2.5" />}
              {saved ? 'Saved' : 'Save'}
            </button>
            <button onClick={downloadContent} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors">
              <Download className="w-2.5 h-2.5" /> Download
            </button>
            <button onClick={() => onRefine(message.content)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors">
              <PenLine className="w-2.5 h-2.5" /> Refine
            </button>
          </div>
        )}
      </div>
    </div>
  );
}