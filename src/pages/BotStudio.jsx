import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Brain, Plug, ArrowLeft } from 'lucide-react';
import OllamaConfig from '@/components/botstudio/OllamaConfig';
import BotGallery from '@/components/botstudio/BotGallery';
import BotEditor from '@/components/botstudio/BotEditor';
import BotChatPanel from '@/components/botstudio/BotChatPanel';
import MemoryPodManager from '@/components/botstudio/MemoryPodManager';
import ConnectivityPanel from '@/components/botstudio/ConnectivityPanel';
import ConnectionStatus from '@/components/botstudio/ConnectionStatus';
import { useOnline } from '@/lib/connectivity';
import * as store from '@/lib/botStudioStore';
import { toast } from 'sonner';

const TABS = [
  { id: 'bots', label: 'Bots', icon: Cpu },
  { id: 'pods', label: 'Memory Pods', icon: Brain },
  { id: 'connect', label: 'Connectivity', icon: Plug },
];

export default function BotStudio() {
  const online = useOnline();
  const [tab, setTab] = useState('bots');
  const [bots, setBots] = useState([]);
  const [pods, setPods] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('gallery'); // gallery | chat | editor
  const [activeBot, setActiveBot] = useState(null);
  const [editingBot, setEditingBot] = useState(null);

  const refresh = useCallback(async () => {
    const [b, p] = await Promise.all([store.listAll('bots'), store.listAll('pods')]);
    setBots((b || []).sort((x, y) => (y.updated_date || '').localeCompare(x.updated_date || '')));
    setPods(p || []);
  }, []);

  useEffect(() => {
    (async () => {
      await store.pullCloud().catch(() => {});
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  // Auto-sync on reconnect.
  useEffect(() => {
    const onOnline = () => {
      store.syncNow().then(() => refresh()).catch(() => {});
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [refresh]);

  function handleActivate(bot) {
    setActiveBot(bot);
    setView('chat');
  }
  function handleEdit(bot) {
    setEditingBot(bot);
    setView('editor');
  }
  function handleNew() {
    setEditingBot(null);
    setView('editor');
  }
  async function handleSaved() {
    await refresh();
    setView('gallery');
    setEditingBot(null);
  }
  function handleCloseEditor() {
    setView('gallery');
    setEditingBot(null);
  }
  function handleCloseChat() {
    setView('gallery');
    setActiveBot(null);
  }
  async function handleDuplicate(bot) {
    const { id, created_date, updated_date, _pending, ...rest } = bot;
    await store.createRow('bots', { ...rest, name: `${bot.name} copy` });
    await refresh();
    toast.success('Duplicated bot.');
  }
  async function handleDelete(bot) {
    if (!confirm(`Delete "${bot.name}"? Its saved chats remain but won't be reachable from this bot.`)) return;
    await store.deleteRow('bots', bot.id);
    await refresh();
    toast.success('Bot deleted.');
  }

  return (
    <div className="min-h-screen bg-background pb-32" style={{ paddingLeft: 'env(safe-area-inset-left,0px)', paddingRight: 'env(safe-area-inset-right,0px)' }}>
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        {/* Header */}
        <Link to="/" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Home
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-300">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Offline AI</p>
            <h1 className="text-lg font-semibold leading-tight text-foreground">Bot Studio</h1>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <ConnectionStatus />
          <OllamaConfig onModels={setModels} />

          {/* Tabs */}
          <div className="flex overflow-hidden rounded-xl border border-border">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 text-[12px] font-medium transition-colors ${tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent'}`}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'bots' && (
            view === 'gallery' ? (
              <BotGallery
                bots={bots}
                pods={pods}
                loading={loading}
                onNew={handleNew}
                onActivate={handleActivate}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ) : view === 'chat' && activeBot ? (
              <div className="eru-theme-card rounded-2xl border border-border p-3">
                <BotChatPanel bot={activeBot} pods={pods} onClose={handleCloseChat} />
              </div>
            ) : view === 'editor' ? (
              <BotEditor bot={editingBot} pods={pods} models={models} onSave={handleSaved} onClose={handleCloseEditor} />
            ) : null
          )}

          {tab === 'pods' && <MemoryPodManager />}
          {tab === 'connect' && <ConnectivityPanel />}
        </div>
      </div>
    </div>
  );
}