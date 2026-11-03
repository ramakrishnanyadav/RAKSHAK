/**
 * Authentication Context for ADAPTIVE-PATH Studio.
 * Handles JWT authentication, Guest / Demo mode, Role permissions, and offline fallback.
 * Strictly typed with zero 'any' types.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types/api';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, role?: string) => Promise<void>;
  guestLogin: () => void;
  logout: () => void;
  hasRole: (allowedRoles: UserRole[]) => boolean;
}

const GUEST_USER: UserProfile = {
  id: 'guest-sih2026',
  email: 'researcher-guest@adaptive-path.local',
  role: 'guest',
  is_active: true,
  is_verified: true,
  created_at: new Date().toISOString(),
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isGuest: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  guestLogin: () => {},
  logout: () => {},
  hasRole: () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check stored auth session or guest mode on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedGuest = localStorage.getItem('apath_guest_mode') === 'true';
      if (storedGuest) {
        setUser(GUEST_USER);
        setIsGuest(true);
        setIsLoading(false);
        return;
      }

      const token = apiClient.getAccessToken();
      if (token) {
        try {
          const profile = await apiClient.getMe();
          setUser(profile);
          setIsGuest(false);
        } catch {
          // Token expired or server unreachable, clear session
          apiClient.setTokens(null, null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const resp = await apiClient.login(email, password);
      setUser(resp.user);
      setIsGuest(false);
      localStorage.removeItem('apath_guest_mode');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, role = 'researcher'): Promise<void> => {
    setIsLoading(true);
    try {
      await apiClient.register(email, password, role);
      // Auto login after registration
      await login(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const guestLogin = () => {
    setUser(GUEST_USER);
    setIsGuest(true);
    localStorage.setItem('apath_guest_mode', 'true');
    apiClient.setTokens(null, null);
  };

  const logout = () => {
    apiClient.logout().catch(() => {});
    setUser(null);
    setIsGuest(false);
    localStorage.removeItem('apath_guest_mode');
  };

  const hasRole = (allowedRoles: UserRole[]): boolean => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isGuest,
        isLoading,
        login,
        register,
        guestLogin,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
