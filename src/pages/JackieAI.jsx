import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import JackieHeader from '../components/jackie/JackieHeader';
import MessageBubble from '../components/jackie/MessageBubble';
import WelcomeScreen from '../components/jackie/WelcomeScreen';
import QuickCommands from '../components/jackie/QuickCommands';
import AssetManager from '../components/jackie/AssetManager';
import InputBar from '../components/jackie/InputBar';

const SYSTEM_PROMPTS = {
  chat: `You are Jackie, an elite AI assistant. Be helpful, concise, and intelligent. Use markdown formatting. Never invent financial data.`,
  code: `You are Jackie Code Engine. Generate production-ready code. Always use markdown code blocks with language tags. When refining, show only the changed code. Be precise and clean. Prefer modern patterns.`,
  visual: `You are Jackie Visual Studio. When asked about layouts/systems/flows, output structured visual descriptions using markdown headers, lists, and tables. Use clear hierarchy. Think in components and modules.`,
  builder: `You are Jackie System Builder. Guide users step-by-step through building complex systems. Break work into phases. Output structured plans with clear milestones. Ask clarifying questions when needed.`,
};

export default function JackieAI() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('chat');
  const [tab, setTab] = useState('main');
  const [showCommands, setShowCommands] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [workingContext, setWorkingContext] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const buildPrompt = useCallback((userMessage) => {
    const systemPrompt = SYSTEM_PROMPTS[mode];
    const contextBlock = workingContext ? `\n[ACTIVE CONTEXT]\n${workingContext}\n[END CONTEXT]\n` : '';
    const history = messages.slice(-20).map(m => `${m.role === 'user' ? 'User' : 'Jackie'}: ${m.content}`).join('\n');
    return `${systemPrompt}${contextBlock}\n\nConversation:\n${history}\nUser: ${userMessage}\n\nJackie:`;
  }, [mode, messages, workingContext]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setShowCommands(false);

    const userMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const prompt = buildPrompt(msg);
    const response = await base44.integrations.Core.InvokeLLM({ prompt });
    const assistantMsg = { role: 'assistant', content: response };
    setMessages(prev => [...prev, assistantMsg]);
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
    if (!workingContext) {
      send(cmd + ' the last output');
    } else {
      send(cmd + ' this:\n' + workingContext.slice(0, 2000));
    }
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
    setProjectName('');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <JackieHeader
        mode={mode} setMode={setMode}
        tab={tab} setTab={setTab}
        onClear={clearChat}
        projectName={projectName}
      />

      {tab === 'main' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 ? (
              <WelcomeScreen mode={mode} onSend={send} />
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
            onSend={() => send()} loading={loading}
            mode={mode}
            showCommands={showCommands}
            onToggleCommands={() => setShowCommands(p => !p)}
          />
        </>
      )}

      {tab === 'assets' && (
        <AssetManager onInject={handleInjectAsset} />
      )}
    </div>
  );
}