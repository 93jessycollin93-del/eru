import TickerBar from '../components/dashboard/TickerBar';
import DataVisualizer from '../components/dashboard/DataVisualizer';
import AppDock from '../components/dashboard/AppDock';
import FinanceModule from '../components/dashboard/FinanceModule';
import PortfolioSummary from '../components/dashboard/PortfolioSummary';
import QuickActions from '../components/dashboard/QuickActions';
import ScreenVisualizer from '../components/dashboard/ScreenVisualizer';
export default function Dashboard() {
  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <TickerBar />
      <PortfolioSummary />
      <QuickActions />
      <div className="px-4 mt-4 space-y-4 pb-4">
        <AppDock />
        <ScreenVisualizer />
        <DataVisualizer />
        <FinanceModule />
      </div>
    </div>
  );
}