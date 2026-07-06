import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft, Send, Loader2, History, Plus, Trash2, Pencil, X, Square, Bot as BotIcon,
} from 'lucide-react';
import { streamChat, friendlyOllamaError, getOllamaUrl } from '@/lib/ollama';
import { useOnline } from '@/lib/connectivity';
import * as store from '@/lib/botStudioStore';
import { toast } from 'sonner';

/**
 * BotChatPanel — streaming chat backed by Ollama. Conversations + messages are
 * persisted (BotChat / BotMessage) and restored on reload. Attached memory pods
 * are injected into the system context.
 */
export default function BotChatPanel({ bot, pods = [], onClose, onRenameBot }) {
  const online = useOnline();
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const scrollRef = useRef(null);
  const abortRef = useRef(null);

  const attachedPods = (bot.memory_pod_ids || []).map((id) => pods.find((p) => p.id === id)).filter(Boolean);

  const loadChats = useCallback(async () => {
    const all = await store.listAll('chats');
    setChats(
      (all || [])
        .filter((c) => c.bot_id === bot.id)
        .sort((a, b) => (b.updated_date || '').localeCompare(a.updated_date || '')),
    );
  }, [bot.id]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const loadMessages = useCallback(async (chatId) => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    const all = await store.listAll('messages');
    setMessages(
      (all || [])
        .filter((m) => m.chat_id === chatId)
        .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || '')),
    );
  }, []);

  useEffect(() => {
    loadMessages(activeChatId);
  }, [activeChatId, loadMessages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function startNewChat() {
    const chat = await store.createRow('chats', { bot_id: bot.id, bot_name: bot.name, title: 'New chat' });
    setChats((c) => [chat, ...c]);
    setActiveChatId(chat.id);
    setShowHistory(false);
  }

  async function deleteChat(id) {
    // delete chat + its messages
    const all = await store.listAll('messages');
    await Promise.all((all || []).filter((m) => m.chat_id === id).map((m) => store.deleteRow('messages', m.id)));
    await store.deleteRow('chats', id);
    if (activeChatId === id) setActiveChatId(null);
    await loadChats();
  }

  function startRename(chat) {
    setRenamingId(chat.id);
    setRenameVal(chat.title || '');
  }

  async function commitRename() {
    if (!renamingId) return;
    const title = renameVal.trim() || 'Untitled';
    await store.updateRow('chats', renamingId, { title });
    setRenamingId(null);
    await loadChats();
  }

  function buildOllamaMessages(history, userInput) {
    const podContext = attachedPods
      .map((p) => `[Memory pod: ${p.name}]\n${p.summary || p.raw_notes || ''}`)
      .join('\n\n');
    const sysContent = [bot.system_prompt, podContext].filter(Boolean).join('\n\n');
    const msgs = [];
    if (sysContent) msgs.push({ role: 'system', content: sysContent });
    for (const m of history) {
      if (m.role === 'user' || m.role === 'assistant') {
        msgs.push({ role: m.role, content: m.content });
      }
    }
    msgs.push({ role: 'user', content: userInput });
    return msgs;
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    if (!online) {
      toast.error("You're offline — Ollama needs a network connection to the host.");
      return;
    }

    let chatId = activeChatId;
    let isNew = false;
    if (!chatId) {
      const chat = await store.createRow('chats', { bot_id: bot.id, bot_name: bot.name, title: text.slice(0, 40) });
      setChats((c) => [chat, ...c]);
      chatId = chat.id;
      setActiveChatId(chatId);
      isNew = true;
    } else if (messages.length === 0) {
      // title the first message
      await store.updateRow('chats', chatId, { title: text.slice(0, 40) });
      await loadChats();
    }

    const userMsg = { chat_id: chatId, role: 'user', content: text, timestamp: new Date().toISOString() };
    await store.createRow('messages', userMsg);
    setMessages((m) => [...m, userMsg]);
    setInput('');

    const ollamaMessages = buildOllamaMessages(messages, text);
    setStreaming(true);
    setMessages((m) => [...m, { chat_id: chatId, role: 'assistant', content: '', timestamp: new Date().toISOString(), _streaming: true }]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const full = await streamChat({
        baseUrl: getOllamaUrl(),
        model: bot.model,
        messages: ollamaMessages,
        temperature: bot.temperature,
        top_p: bot.top_p,
        max_tokens: bot.max_tokens,
        signal: controller.signal,
        onToken: (delta) => {
          setMessages((m) => {
            const cp = [...m];
            const last = cp[cp.length - 1];
            cp[cp.length - 1] = { ...last, content: (last.content || '') + delta };
            return cp;
          });
        },
      });
      const saved = await store.createRow('messages', { chat_id: chatId, role: 'assistant', content: full, timestamp: new Date().toISOString() });
      setMessages((m) => {
        const cp = [...m];
        cp[cp.length - 1] = { ...cp[cp.length - 1], ...saved, _streaming: false };
        return cp;
      });
    } catch (e) {
      const msg = friendlyOllamaError(e);
      setMessages((m) => {
        const cp = [...m];
        const last = cp[cp.length - 1];
        cp[cp.length - 1] = { ...last, content: (last.content || '') + `\n\n⚠️ ${msg}`, _streaming: false, _error: true };
        return cp;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="flex h-[calc(100dvh-12rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border pb-2 mb-2">
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        {bot.avatar_image_url ? (
          <img src={bot.avatar_image_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground"><BotIcon className="h-4 w-4" /></div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{bot.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{bot.model} · {attachedPods.length} pod{attachedPods.length === 1 ? '' : 's'}</p>
        </div>
        <button onClick={() => setShowHistory((s) => !s)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground" aria-label="History">
          <History className="h-4 w-4" />
        </button>
        <button onClick={startNewChat} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground" aria-label="New chat">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* History drawer */}
      {showHistory && (
        <div className="mb-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-secondary/40 p-2 space-y-1">
          {chats.length === 0 && <p className="px-2 py-1 text-[12px] text-muted-foreground">No conversations yet.</p>}
          {chats.map((c) => (
            <div key={c.id} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${c.id === activeChatId ? 'bg-primary/10' : 'hover:bg-accent'}`}>
              {renamingId === c.id ? (
                <>
                  <input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} className="h-7 flex-1 rounded border border-border bg-background px-2 text-[12px] text-foreground" autoFocus />
                  <button onClick={commitRename} className="text-[11px] text-primary">Save</button>
                  <button onClick={() => setRenamingId(null)} className="text-[11px] text-muted-foreground"><X className="h-3 w-3" /></button>
                </>
              ) : (
                <>
                  <button onClick={() => { setActiveChatId(c.id); setShowHistory(false); }} className="flex-1 truncate text-left text-[12px] text-foreground">
                    {c.title || 'Untitled'}
                  </button>
                  <button onClick={() => startRename(c)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => deleteChat(c.id)} className="text-destructive hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto pb-2">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <p className="text-[12px] text-muted-foreground">Say hi to {bot.name}. Responses stream from your Ollama host.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} m={m} />
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-border pt-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={online ? 'Message…' : 'Offline — reconnect to chat'}
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-xl border border-border bg-secondary/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
          />
          {streaming ? (
            <button onClick={stop} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary/60 text-foreground" aria-label="Stop">
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={send} disabled={!input.trim() || streaming || !online} className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50" aria-label="Send">
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m }) {
  const isUser = m.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : m._error
            ? 'border border-destructive/40 bg-destructive/10 text-destructive'
            : 'bg-secondary/70 text-foreground'
        }`}
      >
        {m.content || (m._streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '')}
      </div>
    </div>
  );
}