import { useState, useRef, useEffect, useCallback } from 'react';
import { AlertCircle, ArrowUp, Bot, CheckCircle2, Copy, FlaskConical, Key, Send, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from '@/components/ui/use-toast';
import JackieHeader from '../components/jackie/JackieHeader';
import ConversationSidebar from '../components/jackie/ConversationSidebar.jsx';
import MessageBubble from '../components/jackie/MessageBubble';
import WelcomeScreen from '../components/jackie/WelcomeScreen';
import QuickCommands from '../components/jackie/QuickCommands';
import AssetManager from '../components/jackie/AssetManager';
import EducationPanel from '../components/jackie/EducationPanel';
import FeedbackPanel from '../components/jackie/FeedbackPanel';
import IntegrationsPanel from '../components/jackie/IntegrationsPanel';
import JackieGamificationPanel from '../components/jackie/JackieGamificationPanel';
import FoundryControlPanel from '../components/jackie/FoundryControlPanel';
import InputBar from '../components/jackie/InputBar';
import TelegramBotSetupPanel from '../components/jackie/TelegramBotSetupPanel';
import CodeWorkspace from '../components/jackie/CodeWorkspace';
import PromptLibraryPanel from '../components/jackie/PromptLibraryPanel.jsx';
import { VOICES } from '../components/jackie/VoiceSelector.jsx';
import { selectRelevantMemoryFacts } from '@/lib/jackieMemoryRetrieval';
import { getCachedOrFetch, invalidateCachedValue, writeCachedValue } from '@/lib/metadataCache';

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
  { keywords: ['telegram', 'telegram bots', 'telegram bot management', 'botfather'], path: '/telegram-bots' },
  { keywords: ['jade', 'atelier'], path: '/jta' },
  { keywords: ['creatures'], path: '/creatures' },
  { keywords: ['creator'], path: '/creator' },
];

const MODE_PROMPTS = {
  chat: `You are Jackie, an elite AI assistant. Be helpful, concise, and intelligent. Use markdown formatting. You have permanent access to Jackie's core programming memory covering Python, JavaScript, Java, C++, C#, Ruby, Go, Swift, Kotlin, PHP, C, Rust, Assembly, Bash/Shell, Perl, R, MATLAB, TypeScript, HTML/CSS, Haskell, Scala, Erlang, SQL, Dart, and Lua. Treat this as always-available built-in knowledge for teaching, comparison, generation, debugging, and architecture decisions.`,
  code: `You are Jackie Code Engine, a powerful vibe-coding AI. Generate production-ready code, polished prototypes, sharp refactors, and practical integration plans. Always use markdown code blocks with language tags. Think like a senior full-stack builder who can combine UX taste, system design, debugging, visualizers, tooling, plugins, and cloud execution strategy without losing clarity. You have permanent access to Jackie's core programming memory covering Python, JavaScript, Java, C++, C#, Ruby, Go, Swift, Kotlin, PHP, C, Rust, Assembly, Bash/Shell, Perl, R, MATLAB, TypeScript, HTML/CSS, Haskell, Scala, Erlang, SQL, Dart, and Lua. Use that built-in knowledge proactively whenever coding or explaining.`,
  visual: `You are Jackie Visual Studio. Output structured visual descriptions using markdown headers, lists, and tables. Think in components, modules, visualizers, motion, layout harmony, and what makes a prototype feel alive.`,
  builder: `You are Jackie System Builder. Guide users step-by-step through building complex systems. Break work into phases with clear milestones, tool selections, cloud/runtime needs, and the fastest credible path from idea to working prototype.`,
  conversion: `You are Jackie, a global conversion optimization engine for multilingual AI systems.

Your task is to generate and optimize content for maximum conversion performance across multiple languages, with priority on:
1. Ukrainian
2. Simplified Chinese
3. English
4. Additional languages when beneficial

CORE RULES:
- Do not simply translate
- Recreate meaning naturally in each language
- Optimize for emotional impact and conversion behavior in that culture
- Adjust tone, phrasing, and structure per region
- Preserve intent but adapt expression

PROCESS:
1. Generate a high-conversion English master version
2. Adapt into Ukrainian using native persuasive tone
3. Adapt into Simplified Chinese using native marketing psychology
4. Optionally expand into additional languages if useful
5. Ensure all versions maintain clarity, emotional resonance, conversion intent, and cultural appropriateness

QUALITY RULE:
If any version feels translated instead of native, rewrite it.

When useful, structure output with sections: English Master, Ukrainian, Simplified Chinese, and Optional Expansion. When the user gives short copy, produce polished market-ready versions. When the user gives UI text, keep outputs concise and button-ready.`
};

const THINK_MODES = [
  { id: 'default',    label: 'Default',    emoji: '🧠', color: 'text-primary',     desc: 'Balanced intelligence',             prompt: '' },
  { id: 'builder',   label: 'Builder',    emoji: '🏗️', color: 'text-blue-400',   desc: 'Systems + architecture focus',      prompt: 'THINK MODE: BUILDER — Focus on systems design, architecture decisions, scalability, and step-by-step engineering. Structure your thinking in phases and components.' },
  { id: 'hacker',    label: 'Hacker',     emoji: '💀', color: 'text-red-400',    desc: 'Deep logic + optimization',         prompt: 'THINK MODE: HACKER — Go deep on logic, performance optimization, edge cases, and low-level reasoning. Be terse, technical, and ruthlessly efficient.' },
  { id: 'designer',  label: 'Designer',   emoji: '🎨', color: 'text-pink-400',   desc: 'UI/UX + aesthetics focus',          prompt: 'THINK MODE: DESIGNER — Think in user flows, visual hierarchy, accessibility, and interface patterns. Prioritize clarity, delight, and usability in all output.' },
  { id: 'strategist',label: 'Strategist', emoji: '♟️', color: 'text-yellow-400', desc: 'Game theory + economy balance',     prompt: 'THINK MODE: STRATEGIST — Reason like a game theorist and economist. Analyze incentives, balance mechanics, model player behavior, and optimize for long-term outcomes.' },
  { id: 'explainer', label: 'Explainer',  emoji: '📖', color: 'text-green-400',  desc: 'Simple, clear breakdowns',         prompt: 'THINK MODE: EXPLAINER — Break down every concept into the simplest possible terms. Use analogies, bullet points, and examples. Assume no prior knowledge.' },
];

const FOUNDARY_PERMISSION_RULES = [
  { pattern: /web|search|crawl|browse/, permission: 'bot:websearch' },
  { pattern: /code|dev|developer|decompose|decomposer|reform|refactor|cybernetic|sas/, permission: 'bot:code' },
  { pattern: /squad|pipeline|orchestrate|multi-agent|automation/, permission: 'bot:squad' },
];

function buildFoundryPermissions(lower, hasBotSurface) {
  const permissions = new Set(
    hasBotSurface
      ? ['bot:chat', 'bot:create', 'bot:memory', 'bot:analytics', 'jackie:read', 'jackie:write']
      : ['bot:chat', 'bot:analytics', 'jackie:read']
  );
  FOUNDARY_PERMISSION_RULES.forEach(({ pattern, permission }) => {
    if (pattern.test(lower)) permissions.add(permission);
  });
  return [...permissions];
}

function createSecureKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sk_live_${token}`;
}

export default function JackieAI() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const userEmail = currentUser?.email || '';
  const jackieProgressEntity = base44.entities?.JackieProgress || null;
  const [messages, setMessages] = useState([]);
  const [thinkMode, _setThinkMode] = useState('default');
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
  const [jackieProgress, setJackieProgress] = useState(null);
  const [foundryPreview, setFoundryPreview] = useState(null);
  const [applyingFoundry, setApplyingFoundry] = useState(false);
  const [assistantError, setAssistantError] = useState('');
  const [assetStatus, setAssetStatus] = useState(null);
  const [foundrySecret, setFoundrySecret] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [workspaceCode, setWorkspaceCode] = useState('');
  const bottomRef = useRef(null);
  const scrollPaneRef = useRef(null);

  const openAssetsPanel = useCallback((panel = null) => {
    setTab('assets');
    const targetId = panel === 'promptLibrary' ? 'jackie-prompt-library' : panel === 'conversations' ? 'jackie-asset-manager' : null;
    if (!targetId) return;
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    });
  }, []);

  const refreshAssistantContext = useCallback(async () => {
    try {
      const [bots, keys, progressRows] = await Promise.all([
        getCachedOrFetch({
          key: 'jackie_user_bots',
          maxAgeMs: 5 * 60 * 1000,
          fetcher: () => base44.entities.UserBot.list('-created_date', 20).catch(() => [])
        }).catch(() => []),
        getCachedOrFetch({
          key: 'jackie_active_api_keys',
          maxAgeMs: 2 * 60 * 1000,
          fetcher: () => base44.entities.ApiKey.filter({ status: 'active' }, '-created_date', 50).catch(() => [])
        }).catch(() => []),
        jackieProgressEntity?.list?.('-created_date', 1).catch(() => []) || Promise.resolve([]),
      ]);

      setUserBots(bots || []);
      const safeKeys = keys || [];
      setApiKeyCount(safeKeys.length);
      setApiKeyCapabilities({
        webSearch: safeKeys.some((key) => (key.permissions || []).includes('bot:websearch')),
        code: safeKeys.some((key) => (key.permissions || []).includes('bot:code')),
        squad: safeKeys.some((key) => (key.permissions || []).includes('bot:squad')),
      });
      setJackieProgress(progressRows?.[0] || null);
    } catch (error) {
      setAssetStatus({
        tone: 'warning',
        title: 'Jackie loaded with partial data',
        description: error?.message || 'Some saved content or bot context could not be restored.',
      });
    }
  }, [jackieProgressEntity]);

  useEffect(() => {
    const handleOpenPanel = (event) => {
      const panel = event?.detail?.panel;
      if (!panel) return;
      openAssetsPanel(panel);
    };

    window.addEventListener('open-jackie-panel', handleOpenPanel);
    return () => window.removeEventListener('open-jackie-panel', handleOpenPanel);
  }, [openAssetsPanel]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const requestedPanel = urlParams.get('panel');
    if (requestedPanel === 'promptLibrary' || requestedPanel === 'conversations') {
      openAssetsPanel(requestedPanel);
      window.history.replaceState({}, '', '/jackie');
    }
    refreshAssistantContext();
  }, [openAssetsPanel, refreshAssistantContext]);

  const buildPrompt = useCallback((userMessage, retrievedFacts = []) => {
    const voiceStyle = VOICES.find(v => v.id === voice)?.style || '';
    const thinkModePrompt = THINK_MODES.find(t => t.id === thinkMode)?.prompt || '';
    const enhancementContext = `\n[ENABLED FEATURES]\n- Educational content suggestions: recommend articles, videos, and webinars when users ask to learn a topic.\n- Feedback awareness: encourage users to submit product feedback and improvement ideas when relevant.\n- API integration awareness: mention that connected data platforms can be used for broader financial analysis.\n- Advanced alerts: discuss price and percentage-change triggers for alert customization.\n- Core programming memory: Jackie has built-in master and per-language knowledge for Python, JavaScript, Java, C++, C#, Ruby, Go, Swift, Kotlin, PHP, C, Rust, Assembly, Bash/Shell, Perl, R, MATLAB, TypeScript, HTML/CSS, Haskell, Scala, Erlang, SQL, Dart, and Lua.\n[END FEATURES]`;
    const systemPrompt = `${MODE_PROMPTS[mode]}\n\nVoice & Style: ${voiceStyle}${thinkModePrompt ? '\n\n' + thinkModePrompt : ''}${enhancementContext}`;
    const botContext = userBots.length > 0
      ? `\n[USER'S AI BOTS]\n${userBots.map(b => `- ${b.name} (${b.role}, Lv${b.level || 1}, ${b.xp || 0}XP): ${b.description || b.instructions?.slice(0, 80) || 'no description'}`).join('\n')}\n[END BOTS]`
      : '';
    const keyContext = apiKeyCount > 0
      ? `\n[API KEYS] User has ${apiKeyCount} active key(s). Bot capabilities unlocked via keys: ${[apiKeyCapabilities.webSearch && 'web-search', apiKeyCapabilities.code && 'code-engine', apiKeyCapabilities.squad && 'squad-pipelines'].filter(Boolean).join(', ') || 'basic-only'}. You can reference these capabilities when advising on bot tasks.`
      : '';
    const contextBlock = workingContext ? `\n[ACTIVE CONTEXT]\n${workingContext}\n[END CONTEXT]\n` : '';
    const retrievalBlock = retrievedFacts.length > 0
      ? `\n[RELEVANT MEMORY FACTS]\n${retrievedFacts.map((fact) => `- ${fact}`).join('\n')}\n[END RELEVANT MEMORY FACTS]\n`
      : '';
    const history = messages.slice(-20).map(m => `${m.role === 'user' ? 'User' : 'Jackie'}: ${m.content}`).join('\n');
    return `${systemPrompt}${botContext}${keyContext}${contextBlock}${retrievalBlock}\n\nConversation:\n${history}\nUser: ${userMessage}\n\nJackie:`;
  }, [mode, thinkMode, messages, workingContext, voice, userBots, apiKeyCount, apiKeyCapabilities]);

  const updateJackieProgress = async (changes) => {
    if (!jackieProgressEntity) return null;

    const current = jackieProgress || { xp: 0, level: 1, streak_days: 0, badges: [], messages_sent: 0, resources_opened: 0, feedback_sent: 0 };
    const today = new Date().toISOString().slice(0, 10);
    let streakDays = current.streak_days || 0;
    if (changes.countMessage && current.last_activity_date !== today) {
      streakDays += 1;
    }
    const xp = (current.xp || 0) + (changes.xp || 0);
    const level = xp >= 280 ? 5 : xp >= 180 ? 4 : xp >= 100 ? 3 : xp >= 40 ? 2 : 1;
    const badges = Array.from(new Set([
      ...(current.badges || []),
      ...(changes.badges || []),
      ((current.messages_sent || 0) + (changes.messages_sent || 0)) >= 1 ? 'first_question' : null,
      ((current.resources_opened || 0) + (changes.resources_opened || 0)) >= 1 ? 'curious_investor' : null,
      ((current.feedback_sent || 0) + (changes.feedback_sent || 0)) >= 1 ? 'feedback_helper' : null,
      streakDays >= 3 ? 'streak_3' : null,
    ].filter(Boolean)));
    const payload = {
      xp,
      level,
      streak_days: streakDays,
      last_activity_date: changes.countMessage ? today : current.last_activity_date,
      badges,
      messages_sent: (current.messages_sent || 0) + (changes.messages_sent || 0),
      resources_opened: (current.resources_opened || 0) + (changes.resources_opened || 0),
      feedback_sent: (current.feedback_sent || 0) + (changes.feedback_sent || 0)
    };

    try {
      if (jackieProgress?.id) {
        await jackieProgressEntity.update(jackieProgress.id, payload);
        setJackieProgress({ ...jackieProgress, ...payload });
        return payload;
      }
      const created = await jackieProgressEntity.create(payload);
      setJackieProgress(created);
      return created;
    } catch (error) {
      console.error('Failed to update Jackie progress', error);
      return null;
    }
  };

  const send = async (attachments = []) => {
    const msg = input.trim();
    const files = attachments.length > 0 ? attachments : pendingFiles;
    if (!msg && files.length === 0) return;
    if (loading) return;
    const originalInput = msg;
    const originalFiles = files;
    setInput('');
    setPendingFiles([]);
    setShowCommands(false);
    setAssistantError('');

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

    const preview = buildFoundryPreview(msg);
    if (preview) {
      setFoundryPreview(preview);
      setMessages(prev => [...prev, { role: 'assistant', content: 'I prepared a foundry preview for your bot/key request. Review it below and confirm when ready.' }]);
      await updateJackieProgress({ xp: 10, messages_sent: 1, countMessage: true });
      return;
    }

    setLoading(true);
    try {
      const [profiles, chunks, memories] = await Promise.all([
        base44.entities.BotMemoryProfile.list('-updated_date', 20).catch(() => []),
        base44.entities.BotMemoryChunk.list('-updated_date', 40).catch(() => []),
        base44.entities.BotMemory.list('-updated_date', 80).catch(() => [])
      ]);

      const relevantFacts = selectRelevantMemoryFacts({
        profile: profiles?.[0] || null,
        chunks: (chunks || []).slice(0, 12),
        memories: (memories || []).filter((item) => !item.superseded_by_chunk_id).slice(0, 20),
        query: msg || 'Analyze the attached files.',
        limit: 6
      });

      const prompt = buildPrompt(msg || 'Analyze the attached files.', relevantFacts);
      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        ...(fileUrls.length > 0 ? { file_urls: fileUrls } : {}),
      });

      if (!response) {
        throw new Error('Jackie returned an empty response.');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setWorkingContext(response);
      await updateJackieProgress({ xp: 10, messages_sent: 1, countMessage: true });
    } catch (error) {
      const message = error?.message || 'Jackie could not complete that request.';
      setAssistantError(message);
      setMessages(prev => [...prev, { role: 'assistant', content: `I hit an error while processing that request: ${message}` }]);
      setInput(originalInput);
      setPendingFiles(originalFiles);
      toast({ title: 'Jackie request failed', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = (content) => {
    setWorkingContext(content);
    setInput('Refine this: ');
  };

  const handleInjectAsset = (content) => {
    setWorkingContext(content);
    setWorkspaceCode(content);
    setTab('main');
    setInput('Build from this asset: ');
    setAssetStatus({ tone: 'success', title: 'Asset injected', description: 'Jackie moved the asset into your working context.' });
  };

  const handleQuickCommand = (cmd) => {
    setInput(workingContext ? cmd + ' this:\n' + workingContext.slice(0, 2000) : cmd + ' the last output');
  };

  const handleInjectPrompt = (content) => {
    setInput(content);
    setTab('main');
    setAssetStatus({ tone: 'success', title: 'Prompt ready', description: 'The saved prompt replaced your current input.' });
  };

  const handleAppendPrompt = (content) => {
    setInput((prev) => prev ? `${prev}\n\n${content}` : content);
    setTab('main');
    setAssetStatus({ tone: 'success', title: 'Prompt appended', description: 'Jackie added the saved prompt to your current draft.' });
  };

  useEffect(() => {
    const promptTemplatePayload = Object.entries(MODE_PROMPTS).map(([key, prompt]) => ({ key, prompt }));
    writeCachedValue('jackie_common_prompt_templates', promptTemplatePayload);
  }, []);

  // Auto-scroll to latest message whenever messages or loading state changes.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const handlePaneScroll = () => {
    const offset = scrollPaneRef.current?.scrollTop || 0;
    setShowScrollTop(offset > 280);
  };

  const scrollPaneToTop = () => {
    scrollPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const BUILT_IN_PROGRAMMING_PROMPT = "This bot has access to Jackie's permanent core programming memory with both master and per-language knowledge for Python, JavaScript, Java, C++, C#, Ruby, Go, Swift, Kotlin, PHP, C, Rust, Assembly, Bash/Shell, Perl, R, MATLAB, TypeScript, HTML/CSS, Haskell, Scala, Erlang, SQL, Dart, and Lua. Use that knowledge by default for coding, complex task execution, debugging, refactoring, language comparison, and systems design.";

  const buildFoundryPreview = (message) => {
    const lower = message.toLowerCase();
    const wantsBot = /bot|agent|assistant/.test(lower);
    const wantsKey = /api key|key\b|token/.test(lower);
    if (!wantsBot && !wantsKey) return null;

    const extractedName = /named\s+([\w -]+)/i.exec(message)?.[1]?.trim();
    const linkedBot = userBots[0] || null;
    const draftBot = wantsBot ? {
      name: extractedName || 'New Jackie Bot',
      role: /security|scan|analy[sz]e\s+the\s+app|audit/.test(lower) ? 'security' : /trader/.test(lower) ? 'trader' : /social/.test(lower) ? 'social' : /game/.test(lower) ? 'game_helper' : 'assistant',
      response_style: /short/.test(lower) ? 'short' : /creative/.test(lower) ? 'creative' : /strategic/.test(lower) ? 'strategic' : 'detailed',
      description: message.slice(0, 140),
      instructions: `${BUILT_IN_PROGRAMMING_PROMPT}\n\nCreated from Jackie request: ${message}`,
      memory_enabled: true,
      is_public: /public/.test(lower),
      status: 'active',
      page_assignments: [],
      connected_bot_ids: [],
      handoff_instructions: ''
    } : null;

    return {
      bot: draftBot,
      apiKey: wantsKey ? {
        name: extractedName ? `${extractedName} Access Key` : linkedBot ? `${linkedBot.name} Access Key` : 'Jackie Foundry Key',
        botId: draftBot ? '' : linkedBot?.id || '',
        botName: draftBot?.name || linkedBot?.name || '',
        permissions: buildFoundryPermissions(lower, Boolean(draftBot || linkedBot))
      } : null
    };
  };

  const applyFoundryPreview = async () => {
    if (!foundryPreview) return;
    setApplyingFoundry(true);
    let createdBot = null;
    setAssistantError('');
    try {
      if (foundryPreview.bot) {
        createdBot = await base44.entities.UserBot.create({
          ...foundryPreview.bot,
          created_by: userEmail || undefined,
        });
        setUserBots(prev => {
          const nextBots = [createdBot, ...prev].slice(0, 20);
          writeCachedValue('jackie_user_bots', nextBots);
          invalidateCachedValue('bot_widget_user_bots');
          return nextBots;
        });
      }

      if (foundryPreview.apiKey) {
        const raw = createSecureKey();
        const enc = new TextEncoder().encode(raw);
        const buf = await crypto.subtle.digest('SHA-256', enc);
        const hashed = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        await base44.entities.ApiKey.create({
          name: foundryPreview.apiKey.name,
          hashed_key: hashed,
          key_prefix: raw.slice(0, 15) + '...',
          permissions: foundryPreview.apiKey.permissions,
          status: 'active',
          bot_id: createdBot?.id || foundryPreview.apiKey.botId || null,
          created_by: userEmail || undefined,
        });
        setApiKeyCount(prev => prev + 1);
        setApiKeyCapabilities(prev => ({
          webSearch: prev.webSearch || foundryPreview.apiKey.permissions.includes('bot:websearch'),
          code: prev.code || foundryPreview.apiKey.permissions.includes('bot:code'),
          squad: prev.squad || foundryPreview.apiKey.permissions.includes('bot:squad'),
        }));
        setFoundrySecret({
          name: foundryPreview.apiKey.name,
          raw,
          botName: createdBot?.name || foundryPreview.apiKey.botName || '',
        });
        setMessages(prev => [...prev, { role: 'assistant', content: 'Foundry applied successfully. Your new API key is available below and will only be shown once.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Foundry applied successfully.' }]);
      }

      setFoundryPreview(null);
      toast({
        title: 'Jackie Foundry applied',
        description: foundryPreview.apiKey ? 'The bot and key setup is ready.' : 'The requested Jackie draft has been created.',
      });
      await updateJackieProgress({ xp: 15, messages_sent: 1, countMessage: true });
    } catch (error) {
      const message = error?.message || 'Foundry could not apply that change.';
      setAssistantError(message);
      setMessages(prev => [...prev, { role: 'assistant', content: `Foundry could not finish this request: ${message}` }]);
      toast({ title: 'Foundry apply failed', description: message, variant: 'destructive' });
    } finally {
      setApplyingFoundry(false);
    }
  };

  const discardFoundryPreview = () => {
    setFoundryPreview(null);
    setMessages(prev => [...prev, { role: 'assistant', content: 'Preview discarded. Tell me what to adjust and I’ll prepare a new one.' }]);
  };

  const handleSave = async (content) => {
    const tagMap = { code: 'code', visual: 'ui', builder: 'system', chat: 'general' };
    try {
      await base44.entities.JackieSaved.create({
        title: content.slice(0, 60),
        content,
        tag: tagMap[mode] || 'general',
        asset_type: mode === 'code' ? 'code' : mode === 'visual' ? 'visual' : 'text',
        folder: 'Jackie Assets',
        created_by: userEmail || undefined,
      });
      toast({ title: 'Saved to Jackie assets' });
    } catch (error) {
      toast({ title: 'Save failed', description: error?.message || 'Jackie could not save that asset.', variant: 'destructive' });
    }
  };

  const clearChat = () => {
    setMessages([]);
    setWorkingContext('');
    setPendingFiles([]);
    setAssistantError('');
  };

  const loadConversation = (conversationMessages) => {
    setMessages(Array.isArray(conversationMessages) ? conversationMessages : []);
    setWorkingContext('');
    setTab('main');
    setAssistantError('');
  };

  const copyFoundrySecret = async () => {
    if (!foundrySecret?.raw) return;
    try {
      await navigator.clipboard.writeText(foundrySecret.raw);
      toast({ title: 'API key copied', description: 'Store it now — Jackie will not show it again after you dismiss this card.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy the key manually before dismissing it.', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-36 md:pb-24">
      {/* Cross-system shortcuts */}
      <div className="flex gap-2 px-4 py-2 border-b border-border/50 bg-card/50 overflow-x-auto">
        <button onClick={() => navigate('/ailab')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-semibold flex-shrink-0 hover:bg-primary/20">
          <FlaskConical className="w-3 h-3" /> AI Lab ({userBots.length} bots)
        </button>
        <button onClick={() => navigate('/ailab')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border rounded-xl text-[10px] font-semibold flex-shrink-0 hover:border-primary/30 text-muted-foreground">
          <Bot className="w-3 h-3" /> Bot Test Lab
        </button>
        <button onClick={() => navigate('/apikeys')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border rounded-xl text-[10px] font-semibold flex-shrink-0 hover:border-primary/30 text-muted-foreground">
          <Key className="w-3 h-3" /> API Keys ({apiKeyCount} active)
        </button>
        <button onClick={() => navigate('/telegram-bots')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border rounded-xl text-[10px] font-semibold flex-shrink-0 hover:border-primary/30 text-muted-foreground">
          <Send className="w-3 h-3" /> Telegram Bots
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
          <div className="flex flex-1 flex-col md:flex-row min-h-0">
            <ConversationSidebar
              messages={messages}
              onLoadConversation={loadConversation}
              onNewConversation={clearChat}
              userEmail={userEmail}
            />

            <div ref={scrollPaneRef} onScroll={handlePaneScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {assistantError && (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <span>{assistantError}</span>
                </div>
              )}
              {assetStatus && (
                <div className={`rounded-2xl border px-4 py-3 text-sm flex items-start justify-between gap-3 ${assetStatus.tone === 'warning' ? 'border-amber-500/20 bg-amber-500/5 text-amber-200' : 'border-primary/20 bg-primary/5 text-foreground'}`}>
                  <div>
                    <p className="font-medium">{assetStatus.title}</p>
                    <p className="text-xs mt-1 opacity-80">{assetStatus.description}</p>
                  </div>
                  <button onClick={() => setAssetStatus(null)} className="opacity-60 hover:opacity-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
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

              {foundryPreview && (
                <FoundryControlPanel
                  preview={foundryPreview}
                  onConfirm={applyFoundryPreview}
                  onDiscard={discardFoundryPreview}
                  busy={applyingFoundry}
                />
              )}

              {foundrySecret && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">One-time API key reveal</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {foundrySecret.botName ? `${foundrySecret.botName} is linked to this key.` : 'Store this key now.'} It will not be shown again after you dismiss this card.
                      </p>
                    </div>
                    <button onClick={() => setFoundrySecret(null)} className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground break-all">
                    {foundrySecret.raw}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={copyFoundrySecret} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                      <Copy className="w-3.5 h-3.5" /> Copy key
                    </button>
                    <button onClick={() => setFoundrySecret(null)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5" /> I stored it
                    </button>
                  </div>
                </div>
              )}

              {(mode === 'code' || workspaceCode) && (
                <CodeWorkspace
                  content={workspaceCode || workingContext}
                  onInject={setWorkspaceCode}
                  onSave={handleSave}
                />
              )}

              <TelegramBotSetupPanel onOpenManagement={() => navigate('/telegram-bots')} />

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
        <div ref={scrollPaneRef} onScroll={handlePaneScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <JackieGamificationPanel
            progress={jackieProgress}
            onAction={(action) => {
              if (action === 'education') openAssetsPanel('promptLibrary');
              if (action === 'feedback') document.getElementById('jackie-feedback-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              if (action === 'conversation') setTab('main');
            }}
          />
          <div id="jackie-prompt-library" className="scroll-mt-24">
            <PromptLibraryPanel onInject={handleInjectPrompt} onAppend={handleAppendPrompt} userEmail={userEmail} />
          </div>
          <EducationPanel
            userBotsCount={userBots.length}
            apiKeyCount={apiKeyCount}
            progress={jackieProgress}
            onNavigate={navigate}
            onOpenPanel={openAssetsPanel}
            onResourceOpen={() => updateJackieProgress({ xp: 5, resources_opened: 1 })}
          />
          <div id="jackie-feedback-panel" className="scroll-mt-24">
            <FeedbackPanel userEmail={userEmail} mode={mode} onSubmitted={() => updateJackieProgress({ xp: 15, feedback_sent: 1 })} />
          </div>
          <IntegrationsPanel userBots={userBots} apiKeyCount={apiKeyCount} apiKeyCapabilities={apiKeyCapabilities} onNavigate={navigate} />
          <div id="jackie-asset-manager" className="scroll-mt-24">
            <AssetManager onInject={handleInjectAsset} userEmail={userEmail} />
          </div>
        </div>
      )}

      {showScrollTop && (
        <button
          type="button"
          onClick={scrollPaneToTop}
          className="fixed bottom-24 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/95 px-3 py-2 text-xs font-semibold text-primary shadow-lg backdrop-blur-md"
        >
          <ArrowUp className="w-3.5 h-3.5" /> Top
        </button>
      )}
    </div>
  );
}