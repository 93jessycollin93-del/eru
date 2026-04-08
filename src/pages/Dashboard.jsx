import TickerBar from '../components/dashboard/TickerBar';
import DataVisualizer from '../components/dashboard/DataVisualizer';
import PortfolioSummary from '../components/dashboard/PortfolioSummary';
import QuickActions from '../components/dashboard/QuickActions';
import ScreenVisualizer from '../components/dashboard/ScreenVisualizer';
import { useAuth } from '@/lib/AuthContext';

export default function Dashboard() {
  const { currentUser } = useAuth();
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <TickerBar />
      <PortfolioSummary />
      <QuickActions />
      <div className="px-4 mt-4 space-y-4 pb-4">
        <ScreenVisualizer />
        <DataVisualizer />
      </div>
    </div>
  );
}