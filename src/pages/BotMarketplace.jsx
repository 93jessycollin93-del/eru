import BotMarketplace from '../components/ailab/BotMarketplace';
import { Bot } from 'lucide-react';

export default function BotMarketplacePage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 py-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Bot Marketplace</h1>
            <p className="text-xs text-muted-foreground">Discover, install, rate, review, and share AI bot templates and custom flows.</p>
          </div>
        </div>
      </div>
      <BotMarketplace />
    </div>
  );
}