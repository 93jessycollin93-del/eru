import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/ErrorBoundary';
import Layout from './components/Layout';

// Routes are lazy-loaded to shrink the initial bundle. Eager imports of 30+
// pages inflated the first-load payload noticeably; splitting them lets Vite
// emit a separate chunk per page.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Markets = lazy(() => import('./pages/Markets'));
const Trade = lazy(() => import('./pages/Trade'));
const NFTs = lazy(() => import('./pages/NFTs'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Collectables = lazy(() => import('./pages/Collectables'));
const Messages = lazy(() => import('./pages/Messages'));
const Settings = lazy(() => import('./pages/Settings'));
const CreatorHub = lazy(() => import('./pages/CreatorHub'));
const ThinkersClub = lazy(() => import('./pages/ThinkersClub'));
const AppReview = lazy(() => import('./pages/AppReview'));
const Reputation = lazy(() => import('./pages/Reputation'));
const TelegramApps = lazy(() => import('./pages/TelegramApps'));
const JackieAI = lazy(() => import('./pages/JackieAI'));
const AILab = lazy(() => import('./pages/AILab'));
const APIKeys = lazy(() => import('./pages/APIKeys'));
const SystemBuilder = lazy(() => import('./pages/SystemBuilder'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const AdminBlockchain = lazy(() => import('./pages/AdminBlockchain'));
const JadeAtelier = lazy(() => import('./pages/JadeAtelier'));
const VisualEngine = lazy(() => import('./pages/VisualEngine'));
const CardArena = lazy(() => import('./pages/CardArena'));
const StorefrontHub = lazy(() => import('./pages/StorefrontHub'));
const StorefrontAnalytics = lazy(() => import('./pages/StorefrontAnalytics'));
const CreatureLab = lazy(() => import('./pages/CreatureLab'));
const AdminEconomyDashboard = lazy(() => import('./pages/AdminEconomyDashboard'));
const PerformanceDashboard = lazy(() => import('./pages/PerformanceDashboard'));
const ActivityAuditLog = lazy(() => import('./pages/ActivityAuditLog'));
const BotAutomations = lazy(() => import('./pages/BotAutomations'));
const ComplianceCenter = lazy(() => import('./pages/ComplianceCenter'));
const SecurityDashboard = lazy(() => import('./pages/SecurityDashboard'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const RoleManagement = lazy(() => import('./pages/RoleManagement'));
const BlockchainAnalytics = lazy(() => import('./pages/BlockchainAnalytics'));
const WalletManager = lazy(() => import('./pages/WalletManager'));
const TransactionHistory = lazy(() => import('./pages/TransactionHistory'));

// Payment verification system initialized on app load
import '@/lib/paymentGuards';
import '@/lib/assetGrant';

const LoadingSpinner = () => (
  <div
    className="fixed inset-0 flex items-center justify-center"
    role="status"
    aria-label="Loading"
  >
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

// Wrap a lazy page in a per-route ErrorBoundary + Suspense so a single
// page crash or chunk-load failure cannot take down the rest of the app.
const routeElement = (Component) => (
  <ErrorBoundary>
    <Suspense fallback={<LoadingSpinner />}>
      <Component />
    </Suspense>
  </ErrorBoundary>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return <LoadingSpinner />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={routeElement(Dashboard)} />
        <Route path="/markets" element={routeElement(Markets)} />
        <Route path="/trade" element={routeElement(Trade)} />
        <Route path="/nfts" element={routeElement(NFTs)} />
        <Route path="/portfolio" element={routeElement(Portfolio)} />
        <Route path="/collectables" element={routeElement(Collectables)} />
        <Route path="/messages" element={routeElement(Messages)} />
        <Route path="/settings" element={routeElement(Settings)} />

        <Route path="/creator" element={routeElement(CreatorHub)} />
        <Route path="/thinkers" element={routeElement(ThinkersClub)} />
        <Route path="/review" element={routeElement(AppReview)} />
        <Route path="/reputation" element={routeElement(Reputation)} />
        <Route path="/tgapps" element={routeElement(TelegramApps)} />
        <Route path="/jackie" element={routeElement(JackieAI)} />
        <Route path="/ailab" element={routeElement(AILab)} />
        <Route path="/apikeys" element={routeElement(APIKeys)} />
        <Route path="/builder" element={routeElement(SystemBuilder)} />
        <Route path="/pipeline" element={routeElement(Pipeline)} />
        <Route path="/admin/blockchain" element={routeElement(AdminBlockchain)} />
        <Route path="/jta" element={routeElement(JadeAtelier)} />
        <Route path="/visual" element={routeElement(VisualEngine)} />
        <Route path="/arena" element={routeElement(CardArena)} />
        <Route path="/creatures" element={routeElement(CreatureLab)} />
        <Route path="/storefront" element={routeElement(StorefrontHub)} />
        <Route path="/storefront-analytics" element={routeElement(StorefrontAnalytics)} />
        <Route path="/admin/economy" element={routeElement(AdminEconomyDashboard)} />
        <Route path="/performance" element={routeElement(PerformanceDashboard)} />
        <Route path="/audit" element={routeElement(ActivityAuditLog)} />
        <Route path="/bot-automations" element={routeElement(BotAutomations)} />
        <Route path="/compliance" element={routeElement(ComplianceCenter)} />
        <Route path="/security-dashboard" element={routeElement(SecurityDashboard)} />
        <Route path="/privacy-policy" element={routeElement(PrivacyPolicy)} />
        <Route path="/role-management" element={routeElement(RoleManagement)} />
        <Route path="/blockchain-analytics" element={routeElement(BlockchainAnalytics)} />
        <Route path="/wallet-manager" element={routeElement(WalletManager)} />
        <Route path="/transactions" element={routeElement(TransactionHistory)} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {

  return (
    <ErrorBoundary>
      <ThemeProvider>
      <LanguageProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
          <SonnerToaster />
        </QueryClientProvider>
      </AuthProvider>
      </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
