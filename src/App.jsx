import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { MediaPlayerProvider } from '@/context/MediaPlayerContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ErrorBoundary from '@/components/ErrorBoundary';
import Layout from './components/Layout';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// Pages are lazy-loaded so each route ships in its own chunk instead of one
// ~5MB bundle. The <Suspense> boundary below shows a spinner while a page's
// chunk is fetched.
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Markets = lazy(() => import('./pages/Markets'));
const Trade = lazy(() => import('./pages/Trade'));
const NFTs = lazy(() => import('./pages/NFTs'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Collectables = lazy(() => import('./pages/Collectables'));
const Messages = lazy(() => import('./pages/Messages'));
const Settings = lazy(() => import('./pages/Settings'));
const UserSettings = lazy(() => import('./pages/UserSettings'));
const ProfilePreferences = lazy(() => import('./pages/ProfilePreferences'));
const CreatorHub = lazy(() => import('./pages/CreatorHub'));
const ThinkersClub = lazy(() => import('./pages/ThinkersClub'));
const AppReview = lazy(() => import('./pages/AppReview'));
const Reputation = lazy(() => import('./pages/Reputation'));
const TelegramApps = lazy(() => import('./pages/TelegramApps'));
const TelegramBotManagement = lazy(() => import('./pages/TelegramBotManagement'));
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
const SellerDashboard = lazy(() => import('./pages/SellerDashboard'));
const CreatureLab = lazy(() => import('./pages/CreatureLab'));
const AdminEconomyDashboard = lazy(() => import('./pages/AdminEconomyDashboard'));
const Economy = lazy(() => import('./pages/Economy'));
const PerformanceDashboard = lazy(() => import('./pages/PerformanceDashboard'));
const BotPerformanceHistory = lazy(() => import('./pages/BotPerformanceHistory'));
const ActivityAuditLog = lazy(() => import('./pages/ActivityAuditLog'));
const BotAutomations = lazy(() => import('./pages/BotAutomations'));
const ComplianceCenter = lazy(() => import('./pages/ComplianceCenter'));
const SecurityDashboard = lazy(() => import('./pages/SecurityDashboard'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const RoleManagement = lazy(() => import('./pages/RoleManagement'));
const BlockchainAnalytics = lazy(() => import('./pages/BlockchainAnalytics'));
const WalletManager = lazy(() => import('./pages/WalletManager'));
const TransactionHistory = lazy(() => import('./pages/TransactionHistory'));
const BotMarketplace = lazy(() => import('./pages/BotMarketplace'));
const BotMiniApp = lazy(() => import('./pages/BotMiniApp'));
const SquadPerformance = lazy(() => import('./pages/SquadPerformance'));
const SquadKnowledgeTrends = lazy(() => import('./pages/SquadKnowledgeTrends'));
const BotFarm = lazy(() => import('./pages/BotFarm'));
const AgentOperations = lazy(() => import('./pages/AgentOperations'));
const AnalyticsHub = lazy(() => import('./pages/AnalyticsHub'));
const BazarStand = lazy(() => import('./pages/BazarStand'));
const EscrowDashboard = lazy(() => import('./pages/EscrowDashboard'));
const ReferralDashboard = lazy(() => import('./pages/ReferralDashboard'));
const EruSwarmTest = lazy(() => import('./pages/EruSwarmTest'));
const EruRedteamTest = lazy(() => import('./pages/EruRedteamTest'));
const SheetsSync = lazy(() => import('./pages/SheetsSync'));
const PhoenixInvestor = lazy(() => import('./pages/PhoenixInvestor'));
const AdminReviewCenter = lazy(() => import('./pages/AdminReviewCenter'));
const SecurityCommandCenter = lazy(() => import('./pages/SecurityCommandCenter'));
const SecurityTestRunner = lazy(() => import('./pages/SecurityTestRunner'));
const SecureSliceLab = lazy(() => import('./pages/SecureSliceLab'));
const LanguageDiagnostics = lazy(() => import('./pages/LanguageDiagnostics'));
const AdminBazarProducts = lazy(() => import('./pages/AdminBazarProducts'));
const PlayerProgress = lazy(() => import('./pages/PlayerProgress'));
const LoreInsights = lazy(() => import('./pages/LoreInsights'));
const Preferences = lazy(() => import('./pages/Preferences'));
const Library = lazy(() => import('./pages/Library'));
const DeckBuilder = lazy(() => import('./pages/DeckBuilder'));
const Guilds = lazy(() => import('./pages/Guilds'));
const About = lazy(() => import('./pages/About'));
const AppStore = lazy(() => import('./pages/AppStore'));
const JackieDevLab = lazy(() => import('./pages/JackieDevLab'));
const CardScanner = lazy(() => import('./pages/CardScanner'));
const IntegrationHub = lazy(() => import('./pages/IntegrationHub'));
const Community = lazy(() => import('./pages/Community'));
const SimTradingLab = lazy(() => import('./pages/SimTradingLab'));
const MediaConverter = lazy(() => import('./pages/MediaConverter'));
const BotForge = lazy(() => import('./pages/BotForge'));
const MediaLibrary = lazy(() => import('./pages/MediaLibrary'));
const Playlists = lazy(() => import('./pages/Playlists'));
const PlaylistDetail = lazy(() => import('./pages/PlaylistDetail'));
const CollabPlaylistDetail = lazy(() => import('./pages/CollabPlaylistDetail'));
const SharedPlaylist = lazy(() => import('./pages/SharedPlaylist'));
const Discover = lazy(() => import('./pages/Discover'));
const Listening = lazy(() => import('./pages/Listening'));
const TeamBuilder = lazy(() => import('./pages/TeamBuilder'));
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
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    }>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/markets" element={<Markets />} />
        <Route path="/trade" element={<Trade />} />
        <Route path="/nfts" element={<NFTs />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/collectables" element={<Collectables />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/user-settings" element={<UserSettings />} />
        <Route path="/profile-preferences" element={<ProfilePreferences />} />

        <Route path="/creator" element={<CreatorHub />} />
        <Route path="/thinkers" element={<ThinkersClub />} />
        <Route path="/review" element={<AppReview />} />
        <Route path="/reputation" element={<Reputation />} />
        <Route path="/tgapps" element={<TelegramApps />} />
        <Route path="/telegram-bots" element={<TelegramBotManagement />} />
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
        <Route path="/seller-dashboard" element={<SellerDashboard />} />
        <Route path="/admin/economy" element={<AdminEconomyDashboard />} />
        <Route path="/economy" element={<Economy />} />
        <Route path="/performance" element={<PerformanceDashboard />} />
        <Route path="/bot-performance-history" element={<BotPerformanceHistory />} />
        <Route path="/audit" element={<ActivityAuditLog />} />
        <Route path="/bot-automations" element={<BotAutomations />} />
        <Route path="/compliance" element={<ComplianceCenter />} />
        <Route path="/security-dashboard" element={<SecurityDashboard />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/role-management" element={<RoleManagement />} />
        <Route path="/blockchain-analytics" element={<BlockchainAnalytics />} />
        <Route path="/wallet-manager" element={<WalletManager />} />
        <Route path="/transactions" element={<TransactionHistory />} />
        <Route path="/bot-marketplace" element={<BotMarketplace />} />
        <Route path="/bot-mini-app" element={<BotMiniApp />} />
        <Route path="/squad-performance" element={<SquadPerformance />} />
        <Route path="/squad-knowledge-trends" element={<SquadKnowledgeTrends />} />
        <Route path="/bot-farm" element={<BotFarm />} />
        <Route path="/agent-operations" element={<AgentOperations />} />
        <Route path="/analytics" element={<AnalyticsHub />} />
        <Route path="/bazar-stand" element={<BazarStand />} />
        <Route path="/escrow-dashboard" element={<EscrowDashboard />} />
        <Route path="/referrals" element={<ReferralDashboard />} />
        <Route path="/eru-swarm-test" element={<EruSwarmTest />} />
        <Route path="/eru-redteam-test" element={<EruRedteamTest />} />
        <Route path="/admin/bazar-products" element={<AdminBazarProducts />} />
        <Route path="/sheets-sync" element={<SheetsSync />} />
        <Route path="/storefront/phoenix-investor" element={<PhoenixInvestor />} />
        <Route path="/admin/review" element={<AdminReviewCenter />} />
        <Route path="/admin/security" element={<SecurityCommandCenter />} />
        <Route path="/admin/security-test" element={<SecurityTestRunner />} />
        <Route path="/admin/secure-slice" element={<SecureSliceLab />} />
        <Route path="/language-diagnostics" element={<LanguageDiagnostics />} />
        <Route path="/player-progress" element={<PlayerProgress />} />
        <Route path="/lore-insights" element={<LoreInsights />} />
        <Route path="/preferences" element={<Preferences />} />
        <Route path="/library" element={<Library />} />
        <Route path="/deck-builder" element={<DeckBuilder />} />
        <Route path="/guilds" element={<Guilds />} />
        <Route path="/about" element={<About />} />
        <Route path="/app-store" element={<AppStore />} />
        <Route path="/dev-lab" element={<JackieDevLab />} />
        <Route path="/card-scanner" element={<CardScanner />} />
        <Route path="/integrations" element={<IntegrationHub />} />
        <Route path="/community" element={<Community />} />
        <Route path="/bot-lab" element={<SimTradingLab />} />
        <Route path="/bot-forge" element={<BotForge />} />
        <Route path="/media-converter" element={<MediaConverter />} />
        <Route path="/music" element={<MediaLibrary />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/playlists/:id" element={<PlaylistDetail />} />
        <Route path="/collab/:id" element={<CollabPlaylistDetail />} />
        <Route path="/p/:id" element={<SharedPlaylist />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/listening" element={<Listening />} />
        <Route path="/team-builder" element={<TeamBuilder />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
    </Suspense>
  );
};


function App() {
  // Mobile-native: sync the Tailwind `dark` class on <html> with the OS-level
  // `prefers-color-scheme` media query. We only auto-apply when the user
  // hasn't explicitly chosen a color mode (preserving ThemeContext choice).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      let userPref = null;
      try { userPref = JSON.parse(localStorage.getItem('vse_colorMode')); } catch { /* ignore */ }
      const isDark = userPref ? userPref === 'dark' : mq.matches;
      document.documentElement.classList.toggle('dark', isDark);
    };
    apply();
    mq.addEventListener?.('change', apply);
    window.addEventListener('storage', apply);
    return () => {
      mq.removeEventListener?.('change', apply);
      window.removeEventListener('storage', apply);
    };
  }, []);

  return (
    <ThemeProvider>
    <LanguageProvider>
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <MediaPlayerProvider>
          <ErrorBoundary>
            <Router>
              <AuthenticatedApp />
            </Router>
          </ErrorBoundary>
          <Toaster />
        </MediaPlayerProvider>
      </QueryClientProvider>
    </AuthProvider>
    </LanguageProvider>
    </ThemeProvider>
  )
}

export default App