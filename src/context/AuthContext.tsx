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
import {
  isAuthRetryableFetchError,
  type Session,
  type User,
} from '@supabase/supabase-js';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { mapRecoveryAuthError, normalizeRecoveryEmail } from '@/lib/passwordRecovery';
import {
  AUTH_SESSION_INVALIDATED_EVENT,
  clearLocalAuthStorage,
  SUPABASE_AUTH_STORAGE_KEY,
  supabase,
} from '@/lib/supabase';
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

function isRetryableNetworkAuthError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    return (
      lower.includes('failed to fetch') ||
      lower.includes('networkerror') ||
      lower.includes('load failed')
    );
  }
  return false;
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
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  // Tăng thế hệ xác thực mỗi lần signIn/signOut/recovery để loại bỏ phản hồi cũ đến muộn
  const authGenerationRef = useRef(0);
  // Chặn trình duyệt/Supabase tự phục hồi phiên cũ từ localStorage sau khi đã đăng xuất
  const explicitSignOutRef = useRef(false);
  const lastVerifiedAtRef = useRef(0);

  const performSignOut = useCallback(
    async ({
      markExplicit = true,
      clearError = false,
    }: {
      markExplicit?: boolean;
      clearError?: boolean;
    } = {}) => {
      const gen = ++authGenerationRef.current;
      if (markExplicit) {
        explicitSignOutRef.current = true;
      }
      recoveryPendingRef.current = false;
      setIsPasswordRecovery(false);
      if (clearError) {
        setAuthError(null);
      }

      let timeoutId: number | null = null;
      const remoteSignOut = supabase.auth
        .signOut({ scope: 'global' })
        .catch(() => undefined)
        .finally(() => {
          if (authGenerationRef.current === gen) {
            clearLocalAuthStorage();
          }
        });

      try {
        await Promise.race([
          remoteSignOut,
          new Promise<void>((resolve) => {
            timeoutId = window.setTimeout(resolve, 3500);
          }),
        ]);
      } finally {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      }

      if (authGenerationRef.current === gen) {
        clearLocalAuthStorage();
        setProfile(null);
        setSession(null);
      }
    },
    []
  );

  const loadProfile = useCallback(
    async (userId: string) => {
      const gen = authGenerationRef.current;
      setProfileLoading(true);
      try {
        const [userRes, profileRes] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from('profiles').select('*').eq('id', userId).single<Profile>(),
        ]);

        if (authGenerationRef.current !== gen || explicitSignOutRef.current) {
          return;
        }

        // Nếu JWT không còn phiên hợp lệ trên Supabase Auth (đã đăng xuất/thu hồi) -> dọn sạch phiên ngay
        const userRejected =
          (userRes.error && !isRetryableNetworkAuthError(userRes.error)) ||
          (!userRes.error && !userRes.data.user);

        if (userRejected) {
          await performSignOut({ markExplicit: false, clearError: true });
          return;
        }

        if (profileRes.error || !profileRes.data) {
          setProfile(null);
          setAuthError(
            userRes.error
              ? 'Không thể kết nối máy chủ để xác thực phiên đăng nhập.'
              : 'Không tìm thấy hồ sơ tài khoản trên hệ thống.'
          );
          await performSignOut({ markExplicit: true, clearError: false });
          return;
        }

        if (!profileRes.data.is_active) {
          setProfile(null);
          setAuthError('Tài khoản của bạn đang bị khóa. Vui lòng liên hệ quản trị viên nhà trường.');
          await performSignOut({ markExplicit: true, clearError: false });
          return;
        }

        lastVerifiedAtRef.current = Date.now();
        setAuthError(null);
        setProfile(profileRes.data);
      } finally {
        if (authGenerationRef.current === gen) {
          setProfileLoading(false);
        }
      }
    },
    [performSignOut]
  );

  const verifyActiveSession = useCallback(
    async (force = false) => {
      if (explicitSignOutRef.current) {
        clearLocalAuthStorage();
        if (sessionRef.current) {
          setProfile(null);
          setSession(null);
        }
        return;
      }

      if (!sessionRef.current) return;

      const now = Date.now();
      if (!force && now - lastVerifiedAtRef.current < 3000) {
        return;
      }
      lastVerifiedAtRef.current = now;

      const gen = authGenerationRef.current;
      const {
        data: { session: storedSession },
      } = await supabase.auth.getSession();

      if (authGenerationRef.current !== gen || explicitSignOutRef.current) return;

      if (!storedSession) {
        clearLocalAuthStorage();
        setProfile(null);
        setSession(null);
        return;
      }

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (authGenerationRef.current !== gen || explicitSignOutRef.current) return;

      if ((userErr && !isRetryableNetworkAuthError(userErr)) || (!userErr && !userData.user)) {
        await performSignOut({ markExplicit: false, clearError: true });
      }
    },
    [performSignOut]
  );

  useEffect(() => {
    let mounted = true;
    const initialGen = authGenerationRef.current;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted || authGenerationRef.current !== initialGen) return;
      if (explicitSignOutRef.current) {
        clearLocalAuthStorage();
        setSession(null);
        setSessionReady(true);
        return;
      }
      setSession(data.session ?? null);
      setSessionReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        explicitSignOutRef.current = false;
        recoveryPendingRef.current = true;
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        recoveryPendingRef.current = false;
        setIsPasswordRecovery(false);
      } else if (recoveryPendingRef.current) {
        setIsPasswordRecovery(true);
      }

      // Chặn các sự kiện phục hồi phiên cũ sau khi người dùng đã nhấn Đăng xuất
      if (explicitSignOutRef.current && nextSession && event !== 'PASSWORD_RECOVERY') {
        clearLocalAuthStorage();
        setSession(null);
        setProfile(null);
        setSessionReady(true);
        return;
      }

      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
      }
      setSessionReady(true);
    });

    const handleStorageChange = (event: StorageEvent) => {
      if (!mounted || !SUPABASE_AUTH_STORAGE_KEY || event.key !== SUPABASE_AUTH_STORAGE_KEY) {
        return;
      }
      if (!event.newValue) {
        authGenerationRef.current += 1;
        explicitSignOutRef.current = true;
        recoveryPendingRef.current = false;
        setIsPasswordRecovery(false);
        setProfile(null);
        setSession(null);
      } else {
        explicitSignOutRef.current = false;
        void supabase.auth.getSession().then(({ data }) => {
          if (!mounted || explicitSignOutRef.current) return;
          setSession(data.session ?? null);
        });
      }
    };

    const handleReturnToPage = () => {
      if (!mounted || document.visibilityState === 'hidden') return;
      void verifyActiveSession(false);
    };

    const handleSessionInvalidated = () => {
      if (!mounted) return;
      void verifyActiveSession(true);
    };

    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleReturnToPage);
    window.addEventListener('pageshow', handleReturnToPage);
    window.addEventListener(AUTH_SESSION_INVALIDATED_EVENT, handleSessionInvalidated);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleReturnToPage);
      window.removeEventListener('pageshow', handleReturnToPage);
      window.removeEventListener(AUTH_SESSION_INVALIDATED_EVENT, handleSessionInvalidated);
    };
  }, [verifyActiveSession]);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (!sessionReady) return;
    if (!userId || explicitSignOutRef.current) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    void loadProfile(userId);
  }, [sessionReady, userId, loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      authGenerationRef.current += 1;
      explicitSignOutRef.current = false;
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
          await performSignOut({ markExplicit: true, clearError: true });
          throw new AuthSignInError(
            'profile_invalid',
            'Tài khoản chưa có hồ sơ hợp lệ trên hệ thống.'
          );
        }
        if (!prof.is_active) {
          await performSignOut({ markExplicit: true, clearError: true });
          throw new AuthSignInError(
            'locked',
            'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ nhà trường.'
          );
        }
        lastVerifiedAtRef.current = Date.now();
        setSession(data.session ?? null);
        setProfile(prof);
      }
    },
    [performSignOut]
  );

  const signOut = useCallback(async () => {
    await performSignOut({ markExplicit: true, clearError: true });
  }, [performSignOut]);

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

  const verifyRecoveryOtp = useCallback(
    async (email: string, otpCode: string) => {
      authGenerationRef.current += 1;
      explicitSignOutRef.current = false;
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
          await performSignOut({ markExplicit: true, clearError: true });
          throw new Error('Tài khoản chưa có hồ sơ hợp lệ trên hệ thống.');
        }
        if (!prof.is_active) {
          await performSignOut({ markExplicit: true, clearError: true });
          throw new Error('Tài khoản của bạn đang bị khóa. Vui lòng liên hệ nhà trường.');
        }
        lastVerifiedAtRef.current = Date.now();
        setProfile(prof);
      }
    },
    [performSignOut]
  );

  const completePasswordRecovery = useCallback(
    async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        throw new Error(mapRecoveryAuthError(error.message));
      }

      await performSignOut({ markExplicit: true, clearError: true });
    },
    [performSignOut]
  );

  const cancelPasswordRecovery = useCallback(async () => {
    recoveryPendingRef.current = false;
    setIsPasswordRecovery(false);
    const {
      data: { session: activeSession },
    } = await supabase.auth.getSession();
    if (activeSession) {
      await performSignOut({ markExplicit: true, clearError: true });
    } else {
      clearLocalAuthStorage();
    }
  }, [performSignOut]);

  const refreshProfile = useCallback(async () => {
    if (userId) {
      await loadProfile(userId);
    }
  }, [userId, loadProfile]);

  useRealtimeRefresh({
    channelName: `profile-self-${userId ?? 'anon'}`,
    tables: userId ? [{ table: 'profiles', filter: `id=eq.${userId}` }] : [],
    enabled: Boolean(userId),
    debounceMs: 300,
    onRefresh: refreshProfile,
  });

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
