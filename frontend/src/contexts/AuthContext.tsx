
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../lib/api';
import {
  initializeSession,
  isSessionExpired,
  clearSession,
  setupActivityListeners,
  resetInactivityTimer,
  getRefreshToken
} from '../lib/sessionManager';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  name?: string; // Optional, as it might not be set initially
  profileImage?: string; // Optional, as it might not be set initially
  role: 'USER' | 'ADMIN' | 'MODERATOR';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  checkSession: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if session is valid and not expired
  const checkSession = useCallback(() => {
    if (isSessionExpired()) {
      setUser(null);
      return false;
    }
    // Reset inactivity timer on session check
    resetInactivityTimer();
    return true;
  }, []);

  // Attempt to refresh the session
  const refreshSession = useCallback(async () => {
    try {
      // Try to refresh the token
      const response = await authApi.refreshToken();
      // If successful, initialize a new session
      initializeSession(response.expiresIn);
      return true;
    } catch (error) {
      console.error('Session refresh failed:', error);
      setUser(null);
      clearSession();
      return false;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    // Skip auth initialization on login/signup pages
    if (location.pathname === '/login' || location.pathname === '/signup') {
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        // On initial load, check if a refresh token exists in localStorage
        const currentRefreshToken = getRefreshToken();

        if (currentRefreshToken) {
          try {
            // Attempt to refresh the token to get a new access token and set the Authorization header
            const refreshResponse = await authApi.refreshToken();
            initializeSession(refreshResponse.expiresIn);
            // If refresh is successful, proceed to get current user
            const { user } = await authApi.getCurrentUser();
            setUser(user);
          } catch (refreshError) {
            console.error('Initial refresh or getCurrentUser failed, clearing session:', refreshError);
            clearSession();
            // If refresh fails, it means the refresh token is invalid or expired.
            // No need to redirect here, as the ProtectedRoute will handle it if isAuthenticated is false.
          }
        } else {
          // If no refresh token, session is not active.
          // No action needed here, ProtectedRoute will handle redirection if not authenticated.
        }

        // Initialize session with default expiry (1 hour) if not already done by refresh
        // This is a fallback, as the primary session initialization should happen during login/signup or refresh.
        // Only initialize if a user is set (meaning a successful login/refresh happened)
        if (user) { // Check if user is set from a successful refresh or previous state
          initializeSession(3600);
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    // Set up activity listeners to reset inactivity timer
    if (typeof window !== 'undefined') {
      setupActivityListeners();
    }

    // Set up periodic session check
    const sessionCheckInterval = setInterval(() => {
      if (!checkSession()) {
        // Session expired, try to refresh
        refreshSession().catch(() => {
          // If refresh fails, redirect to login
          toast.error('Your session has expired. Please log in again.');
          navigate('/login');
        });
      }
    }, 60000); // Check every minute

    initAuth();

    // Clean up interval on unmount
    return () => clearInterval(sessionCheckInterval);
  }, [checkSession, refreshSession, navigate, location]);

  const login = async (email: string, password: string) => {
    try {
      const { user, tokens, expiresIn } = await authApi.login(email, password);
      setUser(user);

      // Initialize session with token expiry
      initializeSession(expiresIn);

      // Redirect is handled by the component calling login
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      const { user, tokens, expiresIn } = await authApi.signup(email, password);
      setUser(user);

      // Initialize session with token expiry
      initializeSession(expiresIn);

      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
      setUser(null);
      clearSession();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    refreshSession,
    checkSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
