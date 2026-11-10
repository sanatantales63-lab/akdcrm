import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, SessionState } from '@/services/database';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: SessionState | null;
  isLoading: boolean;
  isOwnerProvisioned: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  provisionInitialOwner: (input: {
    fullName: string;
    email: string;
    password: string;
    recoveryKey: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (input: {
    email: string;
    recoveryKey?: string;
    newPassword?: string;
  }) => Promise<{ message: string }>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
    fullName?: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SessionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwnerProvisioned, setIsOwnerProvisioned] = useState<boolean>(() =>
    authService.isOwnerProvisioned()
  );

  useEffect(() => {
    let mounted = true;
    async function initAuth() {
      try {
        const currentSession = await authService.getSession();
        if (mounted) {
          setSession(currentSession);
          setIsOwnerProvisioned(authService.isOwnerProvisioned());
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    initAuth();

    if (isSupabaseConfigured && supabase) {
      const { data: listener } = supabase.auth.onAuthStateChange(async (_event, supaSession) => {
        if (!mounted) return;
        if (supaSession?.user) {
          setSession({
            user: {
              id: supaSession.user.id,
              email: supaSession.user.email || '',
              full_name:
                (supaSession.user.user_metadata?.full_name as string) || 'AKD Studio Principal',
              role: 'owner',
              created_at: supaSession.user.created_at,
            },
            token: supaSession.access_token,
            expires_at: (supaSession.expires_at || Math.floor(Date.now() / 1000) + 86400) * 1000,
            mode: 'supabase',
          });
        } else {
          setSession(null);
        }
      });
      return () => {
        mounted = false;
        listener.subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const nextSession = await authService.signIn(email, password);
    setSession(nextSession);
  }, []);

  const provisionInitialOwner = useCallback(
    async (input: {
      fullName: string;
      email: string;
      password: string;
      recoveryKey: string;
    }) => {
      const nextSession = await authService.provisionInitialOwner(input);
      setIsOwnerProvisioned(true);
      setSession(nextSession);
    },
    []
  );

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
  }, []);

  const requestPasswordReset = useCallback(
    async (input: { email: string; recoveryKey?: string; newPassword?: string }) => {
      return authService.requestPasswordReset(input);
    },
    []
  );

  const changePassword = useCallback(
    async (input: { currentPassword: string; newPassword: string; fullName?: string }) => {
      await authService.changePassword(input);
      const updated = await authService.getSession();
      if (updated) setSession(updated);
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isOwnerProvisioned,
        signIn,
        provisionInitialOwner,
        signOut,
        requestPasswordReset,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
