import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, FlaskConical, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { logger } from '@/lib/logger';
import JackieHeader from '../components/jackie/JackieHeader';
import MessageBubble from '../components/jackie/MessageBubble';
import WelcomeScreen from '../components/jackie/WelcomeScreen';
import QuickCommands from '../components/jackie/QuickCommands';
import AssetManager from '../components/jackie/AssetManager';
import InputBar from '../components/jackie/InputBar';
import { VOICES } from '../components/jackie/VoiceSelector';

const PAGE_NAV_MAP = [
  { keywords: ['ai lab', 'ailab', 'lab', 'bots', 'bot lab'], path: '/ailab' },
  { keywords: ['api key', 'api keys', 'apikeys', 'keys'], path: '/apikeys' },
  { keywords: ['market', 'markets', 'trade'], path: '/markets' },
  { keywords: ['portfolio'], path: '/portfolio' },
  { keywords: ['dashboard', 'home'], path: '/' },
  { keywords: ['jackie'], path: '/jackie' },
  { keywords: ['nft', 'nfts'], path: '/nfts' },
  { keywords: ['storefront', 'shop', 'store'], path: '/storefront' },
  { keywords: ['settings'], path: '/settings' },
  { keywords: ['arena', 'cards', 'card arena'], path: '/arena' },
  { keywords: ['automations', 'bot automations'], path: '/bot-automations' },
  { keywords: ['jade', 'atelier'], path: '/jta' },
  { keywords: ['creatures'], path: '/creatures' },
  { keywords: ['creator'], path: '/creator' },
];

const MODE_PROMPTS = {
  chat: `You are Jackie, an elite AI assistant. Be helpful, concise, and intelligent. Use markdown formatting.`,
  code: `You are Jackie Code Engine. Generate production-ready code. Always use markdown code blocks with language tags. Be precise and clean.`,
  visual: `You are Jackie Visual Studio. Output structured visual descriptions using markdown headers, lists, and tables. Think in components and modules.`,
  builder: `You are Jackie System Builder. Guide users step-by-step through building complex systems. Break work into phases with clear milestones.`,
};

const THINK_MODES = [
  { id: 'default',    label: 'Default',    emoji: '🧠', color: 'text-primary',     desc: 'Balanced intelligence',             prompt: '' },
  { id: 'builder',   label: 'Builder',    emoji: '🏗️', color: 'text-blue-400',   desc: 'Systems + architecture focus',      prompt: 'THINK MODE: BUILDER — Focus on systems design, architecture decisions, scalability, and step-by-step engineering. Structure your thinking in phases and components.' },
  { id: 'hacker',    label: 'Hacker',     emoji: '💀', color: 'text-red-400',    desc: 'Deep logic + optimization',         prompt: 'THINK MODE: HACKER — Go deep on logic, performance optimization, edge cases, and low-level reasoning. Be terse, technical, and ruthlessly efficient.' },
  { id: 'designer',  label: 'Designer',   emoji: '🎨', color: 'text-pink-400',   desc: 'UI/UX + aesthetics focus',          prompt: 'THINK MODE: DESIGNER — Think in user flows, visual hierarchy, accessibility, and interface patterns. Prioritize clarity, delight, and usability in all output.' },
  { id: 'strategist',label: 'Strategist', emoji: '♟️', color: 'text-yellow-400', desc: 'Game theory + economy balance',     prompt: 'THINK MODE: STRATEGIST — Reason like a game theorist and economist. Analyze incentives, balance mechanics, model player behavior, and optimize for long-term outcomes.' },
  { id: 'explainer', label: 'Explainer',  emoji: '📖', color: 'text-green-400',  desc: 'Simple, clear breakdowns',         prompt: 'THINK MODE: EXPLAINER — Break down every concept into the simplest possible terms. Use analogies, bullet points, and examples. Assume no prior knowledge.' },
];

export default function JackieAI() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [thinkMode] = useState('default');
  const [userBots, setUserBots] = useState([]);
  const [apiKeyCount, setApiKeyCount] = useState(0);
  const [apiKeyCapabilities, setApiKeyCapabilities] = useState({ webSearch: false, code: false, squad: false });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('chat');
  const [tab, setTab] = useState('main');
  const [showCommands, setShowCommands] = useState(false);
  const [workingContext, setWorkingContext] = useState('');
  const [voice, setVoice] = useState('default');
  const [pendingFiles, setPendingFiles] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  useEffect(() => {
    base44.entities.UserBot.list('-created_date', 20)
      .then(b => setUserBots(b))
      .catch(err => logger.error('Failed to load user bots:', err));
    base44.entities.ApiKey.filter({ status: 'active' }, '-created_date', 50)
      .then(keys => {
        setApiKeyCount(keys.length);
        // Check if any key has web search or code capabilities
        const hasBotWeb = keys.some(k => (k.permissions || []).includes('bot:websearch'));
        const hasBotCode = keys.some(k => (k.permissions || []).includes('bot:code'));
        const hasBotSquad = keys.some(k => (k.permissions || []).includes('bot:squad'));
        setApiKeyCapabilities({ webSearch: hasBotWeb, code: hasBotCode, squad: hasBotSquad });
      })
      .catch(err => logger.error('Failed to load API keys:', err));
  }, []);

  const buildPrompt = useCallback((userMessage) => {
    const voiceStyle = VOICES.find(v => v.id === voice)?.style || '';
    const thinkModePrompt = THINK_MODES.find(t => t.id === thinkMode)?.prompt || '';
    const systemPrompt = `${MODE_PROMPTS[mode]}\n\nVoice & Style: ${voiceStyle}${thinkModePrompt ? '\n\n' + thinkModePrompt : ''}`;
    const botContext = userBots.length > 0
      ? `\n[USER'S AI BOTS]\n${userBots.map(b => `- ${b.name} (${b.role}, Lv${b.level || 1}, ${b.xp || 0}XP): ${b.description || b.instructions?.slice(0, 80) || 'no description'}`).join('\n')}\n[END BOTS]`
      : '';
    const keyContext = apiKeyCount > 0
      ? `\n[API KEYS] User has ${apiKeyCount} active key(s). Bot capabilities unlocked via keys: ${[apiKeyCapabilities.webSearch && 'web-search', apiKeyCapabilities.code && 'code-engine', apiKeyCapabilities.squad && 'squad-pipelines'].filter(Boolean).join(', ') || 'basic-only'}. You can reference these capabilities when advising on bot tasks.`
      : '';
    const contextBlock = workingContext ? `\n[ACTIVE CONTEXT]\n${workingContext}\n[END CONTEXT]\n` : '';
    const history = messages.slice(-20).map(m => `${m.role === 'user' ? 'User' : 'Jackie'}: ${m.content}`).join('\n');
    return `${systemPrompt}${botContext}${keyContext}${contextBlock}\n\nConversation:\n${history}\nUser: ${userMessage}\n\nJackie:`;
  }, [mode, thinkMode, messages, workingContext, voice, userBots, apiKeyCount]);

  const send = async (attachments = []) => {
    const msg = input.trim();
    const files = attachments.length > 0 ? attachments : pendingFiles;
    if (!msg && files.length === 0) return;
    if (loading) return;
    setInput('');
    setPendingFiles([]);
    setShowCommands(false);

    // Navigation intent detection
    const navIntent = /^(go to|open|navigate to|show me|take me to|switch to)\s+(.+)/i.exec(msg);
    if (navIntent) {
      const target = navIntent[2].toLowerCase().trim();
      const match = PAGE_NAV_MAP.find(p => p.keywords.some(k => target.includes(k)));
      if (match) {
        setMessages(prev => [...prev, { role: 'user', content: msg }, { role: 'assistant', content: `Navigating to **${match.path}** for you! 🚀` }]);
        setTimeout(() => navigate(match.path), 800);
        return;
      }
    }

    const fileUrls = files.map(f => f.url);
    const displayMsg = msg + (files.length > 0 ? `\n📎 ${files.map(f => f.name).join(', ')}` : '');
    setMessages(prev => [...prev, { role: 'user', content: displayMsg }]);
    setLoading(true);

    const prompt = buildPrompt(msg || 'Analyze the attached files.');
    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      ...(fileUrls.length > 0 ? { file_urls: fileUrls } : {}),
    });

    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setWorkingContext(response);
    setLoading(false);
  };

  const handleRefine = (content) => {
    setWorkingContext(content);
    setInput('Refine this: ');
  };

  const handleInjectAsset = (content) => {
    setWorkingContext(content);
    setTab('main');
    setInput('Build from this asset: ');
  };

  const handleQuickCommand = (cmd) => {
    setInput(workingContext ? cmd + ' this:\n' + workingContext.slice(0, 2000) : cmd + ' the last output');
  };

  const handleSave = async (content) => {
    const tagMap = { code: 'code', visual: 'ui', builder: 'system', chat: 'general' };
    await base44.entities.JackieSaved.create({
      title: content.slice(0, 60),
      content,
      tag: tagMap[mode] || 'general',
      asset_type: mode === 'code' ? 'code' : mode === 'visual' ? 'visual' : 'text',
    });
  };

  const clearChat = () => {
    setMessages([]);
    setWorkingContext('');
    setPendingFiles([]);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-36">
      {/* Cross-system shortcuts */}
      <div className="flex gap-2 px-4 py-2 border-b border-border/50 bg-card/50 overflow-x-auto">
        <button onClick={() => navigate('/ailab')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-semibold flex-shrink-0 hover:bg-primary/20">
          <FlaskConical className="w-3 h-3" /> AI Lab ({userBots.length} bots)
        </button>
        <button onClick={() => navigate('/apikeys')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border rounded-xl text-[10px] font-semibold flex-shrink-0 hover:border-primary/30 text-muted-foreground">
          <Key className="w-3 h-3" /> API Keys ({apiKeyCount} active)
        </button>
        {userBots.slice(0, 3).map(b => (
          <button key={b.id} onClick={() => { setInput(`Use ${b.name} mode: `); }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-secondary border border-border rounded-xl text-[10px] flex-shrink-0 hover:border-primary/30 text-muted-foreground">
            🤖 {b.name}
          </button>
        ))}
      </div>
      <JackieHeader
        mode={mode} setMode={setMode}
        tab={tab} setTab={setTab}
        onClear={clearChat}
      />

      {tab === 'main' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 ? (
              <WelcomeScreen mode={mode} onSend={(s) => setInput(s)} />
            ) : (
              messages.map((m, i) => (
                <MessageBubble
                  key={i}
                  message={m}
                  onSave={handleSave}
                  onRefine={handleRefine}
                  onInject={handleInjectAsset}
                />
              ))
            )}

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

          <QuickCommands visible={showCommands} onCommand={handleQuickCommand} />
          <InputBar
            input={input} setInput={setInput}
            onSend={send} loading={loading}
            mode={mode}
            showCommands={showCommands}
            onToggleCommands={() => setShowCommands(p => !p)}
            voice={voice} setVoice={setVoice}
            onFilesReady={setPendingFiles}
          />
        </>
      )}

      {tab === 'assets' && (
        <AssetManager onInject={handleInjectAsset} />
      )}
    </div>
  );
}