import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getCurrentUser, loginUser, logoutUser } from '../storage/authStorage';
import type { AppUser } from '../types';

interface AuthContextValue {
  currentUser: AppUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      isAuthenticated: Boolean(currentUser),
      login(username, password) {
        const result = loginUser(username, password);
        setCurrentUser(result.user);
        return result.user ? { ok: true } : { ok: false, error: result.error };
      },
      logout() {
        logoutUser();
        setCurrentUser(null);
      },
      refreshUser() {
        setCurrentUser(getCurrentUser());
      },
    }),
    [currentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
