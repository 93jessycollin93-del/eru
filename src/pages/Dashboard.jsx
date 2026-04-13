import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import TickerBar from '../components/dashboard/TickerBar';
import WidgetRulesPanel from '../components/dashboard/WidgetRulesPanel';
import { DashboardEventsProvider } from '../context/DashboardEventsContext';
import DataVisualizer from '../components/dashboard/DataVisualizer';
import WidgetLibrary from '../components/dashboard/WidgetLibrary';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import AppDock from '../components/dashboard/AppDock';
import FinanceModule from '../components/dashboard/FinanceModule';
import PortfolioSummary from '../components/dashboard/PortfolioSummary';
import QuickActions from '../components/dashboard/QuickActions';
import ScreenVisualizer from '../components/dashboard/ScreenVisualizer';
import CollectorLeaderboard from '../components/dashboard/CollectorLeaderboard';
import CollectorRewardsPanel from '../components/dashboard/CollectorRewardsPanel';
import DashboardPanelManager from '../components/dashboard/DashboardPanelManager';
import AlertManager from '../components/AlertManager';
import ExportButton from '../components/dashboard/ExportButton';
import NotificationCenter from '../components/notifications/NotificationCenter';
import TelegramFirstBanner from '../components/telegram/TelegramFirstBanner';
import { useFeatureTracking } from '../hooks/useFeatureTracking';
import { useRealPrices } from '../hooks/useRealPrices';
import { useRealtimeEntityList } from '@/hooks/useLiveSync';
export default function Dashboard() {
  useFeatureTracking('Dashboard');
  const { prices } = useRealPrices();
  const { data: alerts } = useRealtimeEntityList('PriceAlert', { sort: '-created_date', limit: 50 });
  const { data: notifications } = useRealtimeEntityList('AppNotification', { sort: '-created_date', limit: 50 });

  const portfolioData = useMemo(() => ({
    totalBalance: 15250.50,
    totalInvested: 12000,
    netGainLoss: 3250.50,
    roi: 27.09,
  }), []);

  const appData = {
    portfolioData,
    marketData: prices,
    alerts,
    notifications,
  };

  return (
    <DashboardEventsProvider>
      <div className="flex flex-col min-h-screen bg-background pb-24 md:pb-8">
        <div className="px-4 py-3 border-b border-border bg-card/80 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
          <ExportButton appData={appData} />
        </div>
        <div className="px-4 py-2 flex justify-end gap-2 bg-background">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
        <TickerBar />
        <PortfolioSummary />
        <QuickActions />
        <div className="px-4 mt-4 space-y-4 pb-4">
          <TelegramFirstBanner />
          <WidgetRulesPanel />
          <DashboardPanelManager
            collectorRewards={<CollectorRewardsPanel />}
            activeBots={<WidgetLibrary prices={prices} sections={['bot-status']} />}
            quickStats={
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Analytics moved to a dedicated hub</p>
                    <p className="mt-1 text-xs text-muted-foreground">Open the full analytics page for performance monitoring, trends, and usage insights.</p>
                  </div>
                  <Link to="/analytics" className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
                    Open Analytics
                  </Link>
                </div>
              </div>
            }
          />
          <WidgetLibrary prices={prices} sections={['market-pins', 'news-feed', 'ai-insights', 'dashboard-actions']} />
          <AppDock />
          <NotificationCenter />
          <AlertManager />
          <CollectorLeaderboard />
          <FinanceModule />
        </div>
      </div>
    </DashboardEventsProvider>
  );
}