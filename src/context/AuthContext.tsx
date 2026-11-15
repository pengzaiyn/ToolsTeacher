import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { mapRecoveryAuthError, normalizeRecoveryEmail } from '@/lib/passwordRecovery';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

export type AuthSignInErrorCode = 'invalid_credentials' | 'locked' | 'profile_invalid' | 'unknown';

export class AuthSignInError extends Error {
  readonly code: AuthSignInErrorCode;

  constructor(code: AuthSignInErrorCode, message: string) {
    super(message);
    this.name = 'AuthSignInError';
    this.code = code;
  }
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  authError: string | null;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  requestPasswordRecovery: (email: string) => Promise<void>;
  verifyRecoveryOtp: (email: string, otpCode: string) => Promise<void>;
  completePasswordRecovery: (newPassword: string) => Promise<void>;
  cancelPasswordRecovery: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function hasRecoveryUrlMarker(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hash.includes('type=recovery') ||
    window.location.search.includes('type=recovery')
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialRecovery = hasRecoveryUrlMarker();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(initialRecovery);
  const recoveryPendingRef = useRef(initialRecovery);

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
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        recoveryPendingRef.current = true;
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        recoveryPendingRef.current = false;
        setIsPasswordRecovery(false);
      } else if (recoveryPendingRef.current) {
        setIsPasswordRecovery(true);
      }

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
    recoveryPendingRef.current = false;
    setIsPasswordRecovery(false);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes('banned')) {
        throw new AuthSignInError(
          'locked',
          'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ nhà trường.'
        );
      }
      if (lower.includes('invalid login')) {
        throw new AuthSignInError('invalid_credentials', 'Email hoặc mật khẩu chưa đúng.');
      }
      throw new AuthSignInError('unknown', 'Đăng nhập thất bại, vui lòng thử lại.');
    }

    if (data.user) {
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single<Profile>();

      if (pErr || !prof) {
        await supabase.auth.signOut();
        throw new AuthSignInError('profile_invalid', 'Tài khoản chưa có hồ sơ hợp lệ trên hệ thống.');
      }
      if (!prof.is_active) {
        await supabase.auth.signOut();
        throw new AuthSignInError(
          'locked',
          'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ nhà trường.'
        );
      }
      setProfile(prof);
    }
  }, []);

  const signOut = useCallback(async () => {
    recoveryPendingRef.current = false;
    setIsPasswordRecovery(false);
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const requestPasswordRecovery = useCallback(async (email: string) => {
    const normalized = normalizeRecoveryEmail(email);
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalized,
      redirectTo ? { redirectTo } : undefined
    );
    if (error) {
      throw new Error(mapRecoveryAuthError(error.message));
    }
  }, []);

  const verifyRecoveryOtp = useCallback(async (email: string, otpCode: string) => {
    setAuthError(null);
    recoveryPendingRef.current = true;
    setIsPasswordRecovery(true);

    const normalized = normalizeRecoveryEmail(email);
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalized,
      token: otpCode.trim(),
      type: 'recovery',
    });

    if (error) {
      recoveryPendingRef.current = false;
      setIsPasswordRecovery(false);
      throw new Error(mapRecoveryAuthError(error.message));
    }

    if (data.user) {
      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single<Profile>();

      if (pErr || !prof) {
        await supabase.auth.signOut();
        recoveryPendingRef.current = false;
        setIsPasswordRecovery(false);
        throw new Error('Tài khoản chưa có hồ sơ hợp lệ trên hệ thống.');
      }
      if (!prof.is_active) {
        await supabase.auth.signOut();
        recoveryPendingRef.current = false;
        setIsPasswordRecovery(false);
        throw new Error('Tài khoản của bạn đang bị khóa. Vui lòng liên hệ nhà trường.');
      }
      setProfile(prof);
    }
  }, []);

  const completePasswordRecovery = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new Error(mapRecoveryAuthError(error.message));
    }

    await supabase.auth.signOut();
    recoveryPendingRef.current = false;
    setIsPasswordRecovery(false);
    setProfile(null);
    setSession(null);
  }, []);

  const cancelPasswordRecovery = useCallback(async () => {
    recoveryPendingRef.current = false;
    setIsPasswordRecovery(false);
    const {
      data: { session: activeSession },
    } = await supabase.auth.getSession();
    if (activeSession) {
      await supabase.auth.signOut();
      setProfile(null);
      setSession(null);
    }
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
      isPasswordRecovery,
      signIn,
      signOut,
      refreshProfile,
      requestPasswordRecovery,
      verifyRecoveryOtp,
      completePasswordRecovery,
      cancelPasswordRecovery,
    }),
    [
      session,
      profile,
      loading,
      authError,
      isPasswordRecovery,
      signIn,
      signOut,
      refreshProfile,
      requestPasswordRecovery,
      verifyRecoveryOtp,
      completePasswordRecovery,
      cancelPasswordRecovery,
    ]
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
