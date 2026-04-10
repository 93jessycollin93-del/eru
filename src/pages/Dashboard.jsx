import { useState } from 'react';
import TickerBar from '../components/dashboard/TickerBar';
import WidgetRulesPanel from '../components/dashboard/WidgetRulesPanel';
import { DashboardEventsProvider } from '../context/DashboardEventsContext';
import DataVisualizer from '../components/dashboard/DataVisualizer';
import LanguageSwitcher from '../components/LanguageSwitcher';
import AppDock from '../components/dashboard/AppDock';
import FinanceModule from '../components/dashboard/FinanceModule';
import PortfolioSummary from '../components/dashboard/PortfolioSummary';
import QuickActions from '../components/dashboard/QuickActions';
import ScreenVisualizer from '../components/dashboard/ScreenVisualizer';
import AnalyticsWidget from '../components/dashboard/AnalyticsWidget';
import AlertManager from '../components/AlertManager';
import ExportButton from '../components/dashboard/ExportButton';
import NotificationCenter from '../components/notifications/NotificationCenter';
import TelegramFirstBanner from '../components/telegram/TelegramFirstBanner';
import { useFeatureTracking } from '../hooks/useFeatureTracking';
import { useRealPrices } from '../hooks/useRealPrices';
export default function Dashboard() {
  useFeatureTracking('Dashboard');
  const { prices } = useRealPrices();
  const [portfolioData] = useState({
    totalBalance: 15250.50,
    totalInvested: 12000,
    netGainLoss: 3250.50,
    roi: 27.09,
  });

  return (
    <DashboardEventsProvider>
      <div className="flex flex-col min-h-screen bg-background pb-20">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <ExportButton portfolioData={portfolioData} marketData={prices} />
        </div>
        <div className="px-4 py-2 flex justify-end">
          <LanguageSwitcher />
        </div>
        <TickerBar />
        <PortfolioSummary />
        <QuickActions />
        <div className="px-4 mt-4 space-y-4 pb-4">
          <TelegramFirstBanner />
          <WidgetRulesPanel />
          <AppDock />
          <NotificationCenter />
          <AlertManager />
          <AnalyticsWidget />
          <ScreenVisualizer />
          <DataVisualizer />
          <FinanceModule />
        </div>
      </div>
    </DashboardEventsProvider>
  );
}