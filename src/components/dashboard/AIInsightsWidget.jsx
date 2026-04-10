import { Sparkles } from 'lucide-react';

const INSIGHTS = [
  'Your portfolio is leaning heavily toward high-beta assets; consider adding more defensive exposure.',
  'Recent market momentum favors large-cap quality names over speculative positions.',
  'A monthly rebalance rule may improve consistency if your allocations drift beyond 5%.'
];

export default function AIInsightsWidget() {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">AI-driven Insights</h3>
      </div>
      <div className="space-y-2 sm:space-y-3">
        {INSIGHTS.map((insight) => (
          <div key={insight} className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-3">
            <p className="text-xs text-foreground leading-relaxed">{insight}</p>
          </div>
        ))}
      </div>
    </div>
  );
}