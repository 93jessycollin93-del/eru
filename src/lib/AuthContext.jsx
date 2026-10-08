import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { backend } from '@/api/backend';
import { syncCollectorRewardProfile } from '@/lib/collectorRewards';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Ask the backend client who is signed in. With no backend connected this
  // resolves to "signed out", and the app renders as a guest.
  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await backend.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      if (currentUser?.email) {
        syncCollectorRewardProfile(currentUser.email).catch(() => null);
      }
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    backend.auth.logout(shouldRedirect ? '/' : undefined);
  };

  const navigateToLogin = () => {
    backend.auth.redirectToLogin();
  };

  // Session timeout: 30 minutes of inactivity
  const sessionTimeoutRef = useRef(null);
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  const resetSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }

    if (!isAuthenticated) return;

    sessionTimeoutRef.current = setTimeout(() => {
      logout(false);
      console.log('Session expired due to inactivity');
    }, SESSION_TIMEOUT);
  }, [isAuthenticated]);

  // Reset timeout on user activity
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleActivity = () => {
      resetSessionTimeout();
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);

    resetSessionTimeout();

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, [isAuthenticated, resetSessionTimeout]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authChecked,
      authError,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkAppState: checkUserAuth,
      checkUserAuth,
      currentUser: user
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
