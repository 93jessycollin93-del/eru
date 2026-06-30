import { ArrowRight, BookOpen, KeyRound, Bot, MessageSquare } from 'lucide-react';

function ActionCard({ title, description, icon: Icon, cta, onClick }) {
  return (
    <button onClick={onClick} className="w-full rounded-xl border border-border bg-card p-3 text-left hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{description}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary">{cta} <ArrowRight className="w-3 h-3" /></span>
        </div>
      </div>
    </button>
  );
}

export default function EducationPanel({ userBotsCount = 0, apiKeyCount = 0, progress, onNavigate, onOpenPanel, onResourceOpen }) {
  const data = progress || { messages_sent: 0, resources_opened: 0, feedback_sent: 0 };
  const steps = [
    userBotsCount > 0
      ? {
          title: 'Expand your bot lineup',
          description: `You already have ${userBotsCount} bot${userBotsCount === 1 ? '' : 's'} in AI Lab. Train, test, or deploy the next improvement loop from there.`,
          icon: Bot,
          cta: 'Open AI Lab',
          onClick: () => onNavigate?.('/ailab'),
        }
      : {
          title: 'Create your first Jackie bot',
          description: 'Start in AI Lab so Jackie can attach real automations, memory, and deployment settings to your workflow.',
          icon: Bot,
          cta: 'Create a bot',
          onClick: () => onNavigate?.('/ailab'),
        },
    apiKeyCount > 0
      ? {
          title: 'Review your active key access',
          description: `${apiKeyCount} API key${apiKeyCount === 1 ? '' : 's'} already exist. Tighten permissions or connect them to the right bots.`,
          icon: KeyRound,
          cta: 'Manage keys',
          onClick: () => onNavigate?.('/apikeys'),
        }
      : {
          title: 'Unlock connected workflows',
          description: 'Generate an API key so Jackie can coordinate bot-linked access, web search, and external execution surfaces.',
          icon: KeyRound,
          cta: 'Create an API key',
          onClick: () => onNavigate?.('/apikeys'),
        },
    {
      title: 'Build a reusable prompt system',
      description: data.messages_sent > 0
        ? 'You have already started chatting with Jackie. Save the strongest instructions into the Prompt Library and keep iterating.'
        : 'Start by drafting one strong system prompt, then store it in Prompt Library so the rest of Jackie can reuse it.',
      icon: data.messages_sent > 0 ? MessageSquare : BookOpen,
      cta: 'Open Prompt Library',
      onClick: () => {
        onOpenPanel?.('promptLibrary');
        onResourceOpen?.();
      },
    },
  ];

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-1">Guided next steps</h3>
        <p className="text-xs text-muted-foreground">Jackie now recommends actions from your actual ERU setup instead of static off-platform learning links.</p>
      </div>
      <div className="grid gap-2">
        {steps.map((step) => (
          <ActionCard key={step.title} {...step} />
        ))}
      </div>
    </div>
  );
}
