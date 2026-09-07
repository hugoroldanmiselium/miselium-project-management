import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isProjectManager: boolean;
  /** ADMIN or PROJECT_MANAGER - the "can manage content" tier: clients/projects/tasks
   *  CRUD, task assignment, project team management. Mirrors the DB helper
   *  current_role_is_admin_or_pm() in 008_org_scoped_rls.sql. Does NOT cover the
   *  ADMIN-only slice (changing a user's role or daily_available_hours). */
  canManage: boolean;
  /** ADMIN (implicit) or profile.finance_access = true. Mirrors the DB helper
   *  has_finance_access() in 011_finance_module.sql. Gates the Finanzas nav
   *  item and pages client-side; RLS is the real enforcement. */
  hasFinanceAccess: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile(userId: string) {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (profileError) {
      setError(profileError.message);
      setProfile(null);
      return;
    }
    setProfile(data as Profile);
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      return { error: signInError.message };
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }

  const isAdmin = profile?.role === 'ADMIN';
  const isProjectManager = profile?.role === 'PROJECT_MANAGER';

  const value: AuthContextValue = {
    session,
    profile,
    loading,
    error,
    signIn,
    signOut,
    isAdmin,
    isProjectManager,
    canManage: isAdmin || isProjectManager,
    hasFinanceAccess: isAdmin || !!profile?.finance_access,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
