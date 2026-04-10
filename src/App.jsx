import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Markets from './pages/Markets';
import Trade from './pages/Trade';
import NFTs from './pages/NFTs';
import Portfolio from './pages/Portfolio';
import Collectables from './pages/Collectables';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import Workstation from './pages/Workstation';
import CreatorHub from './pages/CreatorHub';
import ThinkersClub from './pages/ThinkersClub';
import AppReview from './pages/AppReview';
import Reputation from './pages/Reputation';
import TelegramApps from './pages/TelegramApps';
import JackieAI from './pages/JackieAI';
import AILab from './pages/AILab';
import APIKeys from './pages/APIKeys';
import SystemBuilder from './pages/SystemBuilder';
import Pipeline from './pages/Pipeline';
import AdminBlockchain from './pages/AdminBlockchain';
import JadeAtelier from './pages/JadeAtelier';
import VisualEngine from './pages/VisualEngine';
import CardArena from './pages/CardArena';
import StorefrontHub from './pages/StorefrontHub';
import StorefrontAnalytics from './pages/StorefrontAnalytics';
import CreatureLab from './pages/CreatureLab';
import AdminEconomyDashboard from './pages/AdminEconomyDashboard';
import PerformanceDashboard from './pages/PerformanceDashboard';
import ActivityAuditLog from './pages/ActivityAuditLog';
// Payment verification system initialized on app load
import '@/lib/paymentGuards';
import '@/lib/assetGrant';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
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
        <Route path="/" element={<Dashboard />} />
        <Route path="/markets" element={<Markets />} />
        <Route path="/trade" element={<Trade />} />
        <Route path="/nfts" element={<NFTs />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/collectables" element={<Collectables />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/workstation" element={<Workstation />} />
        <Route path="/creator" element={<CreatorHub />} />
        <Route path="/thinkers" element={<ThinkersClub />} />
        <Route path="/review" element={<AppReview />} />
        <Route path="/reputation" element={<Reputation />} />
        <Route path="/tgapps" element={<TelegramApps />} />
        <Route path="/jackie" element={<JackieAI />} />
        <Route path="/ailab" element={<AILab />} />
        <Route path="/apikeys" element={<APIKeys />} />
        <Route path="/builder" element={<SystemBuilder />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/admin/blockchain" element={<AdminBlockchain />} />
        <Route path="/jta" element={<JadeAtelier />} />
        <Route path="/visual" element={<VisualEngine />} />
        <Route path="/arena" element={<CardArena />} />
        <Route path="/creatures" element={<CreatureLab />} />
        <Route path="/storefront" element={<StorefrontHub />} />
        <Route path="/storefront-analytics" element={<StorefrontAnalytics />} />
        <Route path="/admin/economy" element={<AdminEconomyDashboard />} />
        <Route path="/performance" element={<PerformanceDashboard />} />
        <Route path="/audit" element={<ActivityAuditLog />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {

  return (
    <ThemeProvider>
    <LanguageProvider>
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
    </LanguageProvider>
    </ThemeProvider>
  )
}

export default App