import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single<Profile>();

      if (error || !data) {
        setProfile(null);
        setAuthError('Không tìm thấy hồ sơ tài khoản trên hệ thống.');
        await supabase.auth.signOut();
        return;
      }

      if (!data.is_active) {
        setProfile(null);
        setAuthError('Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên nhà trường.');
        await supabase.auth.signOut();
        return;
      }

      setAuthError(null);
      setProfile(data);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setSessionReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
      }
      setSessionReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (!sessionReady) return;
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    void loadProfile(userId);
  }, [sessionReady, userId, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('banned')) {
        throw new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ nhà trường.');
      }
      if (error.message.toLowerCase().includes('invalid login')) {
        throw new Error('Email hoặc mật khẩu chưa đúng.');
      }
      throw new Error('Đăng nhập thất bại, vui lòng thử lại.');
    }

    if (data.user) {
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single<Profile>();

      if (pErr || !prof) {
        await supabase.auth.signOut();
        throw new Error('Tài khoản chưa có hồ sơ hợp lệ trên hệ thống.');
      }
      if (!prof.is_active) {
        await supabase.auth.signOut();
        throw new Error('Tài khoản của bạn đang bị khóa. Vui lòng liên hệ nhà trường.');
      }
      setProfile(prof);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (userId) {
      await loadProfile(userId);
    }
  }, [userId, loadProfile]);

  const loading = !sessionReady || (Boolean(userId) && profileLoading && !profile);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      authError,
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, authError, signIn, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth phải được dùng bên trong AuthProvider');
  }
  return ctx;
}

