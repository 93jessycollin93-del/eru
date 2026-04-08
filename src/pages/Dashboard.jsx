import TickerBar from '../components/dashboard/TickerBar';
import PortfolioSummary from '../components/dashboard/PortfolioSummary';
import QuickActions from '../components/dashboard/QuickActions';
import ScreenVisualizer from '../components/dashboard/ScreenVisualizer';
import { useAuth } from '@/lib/AuthContext';

export default function Dashboard() {
  const { currentUser } = useAuth();
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <TickerBar />
      <div className="px-4 pt-4 pb-2">
        <p className="text-muted-foreground text-xs font-mono">WELCOME BACK</p>
        <h1 className="text-xl font-semibold text-foreground">{currentUser?.full_name || 'Trader'}</h1>
      </div>
      <PortfolioSummary />
      <QuickActions />
      <div className="px-4 mt-4 pb-4">
        <ScreenVisualizer />
      </div>
    </div>
  );
}