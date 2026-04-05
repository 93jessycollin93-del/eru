import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from './context/ThemeContext';
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
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {

  return (
    <ThemeProvider>
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}

export default App