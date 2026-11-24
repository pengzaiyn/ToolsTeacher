// Lucian UX/UI Prompt #062 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#062
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, KeyRound, Lock, Mail } from 'lucide-react';
import { AuthSignInError, useAuth } from '@/context/AuthContext';
import { isValidAvatarUrl } from '@/lib/avatar';
import { ROLE_LABELS } from '@/lib/roles';
import {
  createMathCaptcha,
  verifyMathCaptcha,
  type MathCaptchaChallenge,
} from '@/lib/mathCaptcha';
import {
  clearFailedLoginAttempts,
  MAX_FAILED_LOGIN_ATTEMPTS,
  normalizeRecoveryEmail,
  recordFailedLoginAttempt,
} from '@/lib/passwordRecovery';
import { CustomWallpaperBackdrop } from '@/components/custom-theme/CustomWallpaperBackdrop';
import { MathCaptchaField } from '@/components/MathCaptchaField';
import { PasswordRecoveryPanel } from '@/components/PasswordRecoveryPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LoadingState } from '@/components/ui/Spinner';
import './lucian-062.css';

const MAX_CAPTCHA_ATTEMPTS = 5;
const CAPTCHA_COOLDOWN_SECONDS = 5;

interface LoginLocationState {
  from?: string;
  recoveredEmail?: string;
  recoverySuccess?: string;
}

export function Login() {
  const { user, profile, loading, authError, isPasswordRecovery, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LoginLocationState | null;

  const [mode, setMode] = useState<'login' | 'recovery'>('login');
  const [email, setEmail] = useState(() => locationState?.recoveredEmail ?? '');
  const [password, setPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState(() => locationState?.recoveredEmail ?? '');
  const [recoveryReason, setRecoveryReason] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(
    () => locationState?.recoverySuccess ?? null
  );

  const [captcha, setCaptcha] = useState<MathCaptchaChallenge>(() => createMathCaptcha());
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [failedCaptchaCount, setFailedCaptchaCount] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // #062 Sign-in card feedback states
  const [btnState, setBtnState] = useState<'idle' | 'busy' | 'ok'>('idle');
  const [welcomeIn, setWelcomeIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [badField, setBadField] = useState<'email' | 'password' | 'both' | null>(null);
  const [passwordInlineError, setPasswordInlineError] = useState<string | null>(null);
  const [cardShaking, setCardShaking] = useState(false);

  const uid = useId().replace(/:/g, '');
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const enterBtnRef = useRef<HTMLButtonElement>(null);
  const welcomeTimerRef = useRef<number | undefined>(undefined);
  const hasRevealedRef = useRef(false);

  function navigateWithCircleReveal(
    target: string,
    reducedMotion: boolean,
    origin?: { x: number; y: number }
  ) {
    if (hasRevealedRef.current) return;
    hasRevealedRef.current = true;

    const docWithTransition = document as Document & {
      startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> };
    };

    if (reducedMotion || typeof docWithTransition.startViewTransition !== 'function') {
      navigate(target, { replace: true });
      return;
    }

    const rect = enterBtnRef.current?.getBoundingClientRect();
    const cx =
      origin?.x ??
      (rect && rect.width > 0 ? rect.left + rect.width / 2 : window.innerWidth / 2);
    const cy =
      origin?.y ??
      (rect && rect.height > 0 ? rect.top + rect.height / 2 : window.innerHeight / 2);
    const radius = Math.hypot(
      Math.max(cx, window.innerWidth - cx),
      Math.max(cy, window.innerHeight - cy)
    );

    const root = document.documentElement;
    root.style.setProperty('--login-cx', `${cx.toFixed(0)}px`);
    root.style.setProperty('--login-cy', `${cy.toFixed(0)}px`);
    root.style.setProperty('--login-r', `${Math.ceil(radius)}px`);
    root.classList.add('login-circle-reveal');

    const transition = docWithTransition.startViewTransition(async () => {
      if (target === '/tools') {
        await import('@/pages/Tools');
      }
      flushSync(() => {
        navigate(target, { replace: true });
      });
    });

    void transition.finished.finally(() => {
      root.classList.remove('login-circle-reveal');
    });
  }

  function handleEnterHome(event: MouseEvent<HTMLButtonElement>) {
    if (loading) return;
    const rm =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasPointerCoords = event.clientX > 0 || event.clientY > 0;
    const origin = hasPointerCoords
      ? { x: event.clientX, y: event.clientY }
      : undefined;
    navigateWithCircleReveal(redirectTarget, rm, origin);
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(welcomeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (welcomeIn) {
      enterBtnRef.current?.focus({ preventScroll: true });
    }
  }, [welcomeIn]);

  function triggerCardShake(target: 'email' | 'password' | 'both') {
    setBadField(target);
    setCardShaking(false);
    window.requestAnimationFrame(() => {
      setCardShaking(true);
    });
    if (target === 'email') {
      emailInputRef.current?.focus({ preventScroll: true });
    } else {
      passwordInputRef.current?.focus({ preventScroll: true });
      passwordInputRef.current?.select();
    }
  }

  function handlePasswordKey(event: KeyboardEvent<HTMLInputElement>) {
    if (typeof event.getModifierState === 'function') {
      setCapsLockOn(event.getModifierState('CapsLock'));
    }
  }

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setCooldownSeconds((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          setCaptchaError(null);
        }
        return next;
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  function refreshCaptcha(clearFieldError = true) {
    setCaptcha(createMathCaptcha());
    setCaptchaInput('');
    if (clearFieldError) {
      setCaptchaError(null);
    }
  }

  const redirectTarget =
    locationState?.from &&
    locationState.from.startsWith('/') &&
    !locationState.from.startsWith('/login')
      ? locationState.from
      : '/tools';

  if (loading && btnState === 'idle' && !welcomeIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page p-6">
        <div className="w-full max-w-sm">
          <LoadingState message="Đang tải hệ thống..." />
        </div>
      </div>
    );
  }

  if (isPasswordRecovery && mode !== 'recovery') {
    return <Navigate to="/reset-password" replace />;
  }

  if (user && profile && !isPasswordRecovery && btnState === 'idle' && !welcomeIn) {
    return <Navigate to={redirectTarget} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (btnState !== 'idle') return;

    setError(null);
    setSuccessNotice(null);
    setCaptchaError(null);
    setPasswordInlineError(null);

    if (cooldownSeconds > 0) {
      setError(
        `Bạn đã nhập sai mã xác minh nhiều lần. Vui lòng chờ ${cooldownSeconds} giây rồi thử lại.`
      );
      return;
    }

    if (!email.trim() || !password) {
      const msg = 'Vui lòng nhập đầy đủ email và mật khẩu.';
      if (!email.trim()) {
        setError(msg);
        triggerCardShake('email');
      } else {
        setPasswordInlineError(msg);
        triggerCardShake('password');
      }
      return;
    }

    if (!captchaInput.trim()) {
      setCaptchaError('Vui lòng nhập kết quả phép tính xác minh.');
      return;
    }

    if (!verifyMathCaptcha(captchaInput, captcha)) {
      const nextCount = failedCaptchaCount + 1;
      if (nextCount >= MAX_CAPTCHA_ATTEMPTS) {
        setFailedCaptchaCount(0);
        setCooldownSeconds(CAPTCHA_COOLDOWN_SECONDS);
        setCaptchaError(
          `Nhập sai mã xác minh nhiều lần. Vui lòng chờ ${CAPTCHA_COOLDOWN_SECONDS} giây và thử phép tính mới.`
        );
      } else {
        setFailedCaptchaCount(nextCount);
        setCaptchaError('Kết quả xác minh chưa đúng. Vui lòng tính lại phép tính mới.');
      }
      refreshCaptcha(false);
      return;
    }

    setFailedCaptchaCount(0);
    setBadField(null);
    setBtnState('busy');
    const normalizedEmail = normalizeRecoveryEmail(email);

    const startedAt = Date.now();
    try {
      await signIn(normalizedEmail, password);
      clearFailedLoginAttempts(normalizedEmail);
      if (redirectTarget === '/tools') {
        void import('@/pages/Tools');
      }

      const rm =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const elapsed = Date.now() - startedAt;
      const minSpinMs = rm ? 0 : Math.max(0, 820 - elapsed);

      if (minSpinMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, minSpinMs));
      }

      setBtnState('ok');

      welcomeTimerRef.current = window.setTimeout(() => {
        setWelcomeIn(true);
      }, rm ? 160 : 650);
    } catch (err) {
      setBtnState('idle');
      if (err instanceof AuthSignInError && err.code === 'invalid_credentials') {
        const nextAttempts = recordFailedLoginAttempt(normalizedEmail);
        if (nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
          setRecoveryEmail(normalizedEmail);
          setRecoveryReason(
            `Bạn đã nhập sai mật khẩu ${nextAttempts} lần cho tài khoản ${normalizedEmail}. Vui lòng xác nhận để nhận mã lấy lại mật khẩu qua email.`
          );
          setMode('recovery');
          setPassword('');
          setError(null);
          setPasswordInlineError(null);
          setBadField(null);
          refreshCaptcha(true);
          return;
        }
        setPasswordInlineError(
          `Email hoặc mật khẩu chưa đúng (lần sai ${nextAttempts}/${MAX_FAILED_LOGIN_ATTEMPTS}).`
        );
        triggerCardShake('password');
      } else {
        setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
        triggerCardShake('both');
      }
      refreshCaptcha(true);
    }
  }

  function openManualRecovery() {
    setError(null);
    setPasswordInlineError(null);
    setSuccessNotice(null);
    setRecoveryEmail(normalizeRecoveryEmail(email));
    setRecoveryReason(null);
    setMode('recovery');
  }

  const displayError = error ?? authError;
  const welcomeName = profile?.full_name || email.split('@')[0] || '';
  const welcomeMeta = profile
    ? profile.class_name
      ? `${ROLE_LABELS[profile.role]} · ${profile.class_name}`
      : ROLE_LABELS[profile.role]
    : email;
  const isBusyOrOk = btnState !== 'idle';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-surface-page px-4 py-8">
      <CustomWallpaperBackdrop />
      <div className="fixed right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div
        className={`ux u062 relative z-10 max-w-md ${cardShaking ? 'shake' : ''} ${
          welcomeIn ? 'is-in' : ''
        }`}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) setCardShaking(false);
        }}
      >
        <div className="u062-pane u062-login p-6 sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-4 text-center">
            <div className="flex w-full items-center justify-center">
              <img
                src="/logo-light.png"
                alt="Trường Cao đẳng Việt Mỹ Hà Nội"
                className="h-24 w-auto max-w-full object-contain dark:hidden sm:h-28"
              />
              <img
                src="/logo-dark.png"
                alt="Trường Cao đẳng Việt Mỹ Hà Nội"
                className="hidden h-24 w-auto max-w-full object-contain dark:block sm:h-28"
              />
            </div>
            <h1 className="sr-only">Đăng nhập Trường Cao đẳng Việt Mỹ Hà Nội</h1>
          </div>

          {mode === 'recovery' ? (
            <PasswordRecoveryPanel
              initialEmail={recoveryEmail}
              reasonMessage={recoveryReason}
              hasRecoverySession={isPasswordRecovery}
              onCompleted={(recovered) => {
                if (recovered) {
                  setEmail(recovered);
                }
                setPassword('');
                setError(null);
                setPasswordInlineError(null);
                setRecoveryReason(null);
                setSuccessNotice(
                  'Đặt lại mật khẩu mới thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.'
                );
                refreshCaptcha(true);
                setMode('login');
              }}
              onBackToLogin={() => {
                setRecoveryReason(null);
                setError(null);
                setPasswordInlineError(null);
                refreshCaptcha(true);
                setMode('login');
              }}
            />
          ) : (
            <>
              {successNotice && (
                <div
                  role="status"
                  className="mb-4 flex items-start gap-2 rounded-lg border border-status-successBorder bg-status-successBg p-4 text-sm font-semibold text-status-successText"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{successNotice}</span>
                </div>
              )}

              {displayError && (
                <div
                  role="alert"
                  className="mb-4 rounded-lg border border-status-dangerBorder bg-status-dangerBg p-4 text-sm font-semibold text-status-dangerText"
                >
                  {displayError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col" noValidate>
                <div
                  className={`u062-f ${badField === 'email' || badField === 'both' ? 'bad' : ''}`}
                >
                  <label htmlFor={`${uid}-email`}>Email nhà trường</label>
                  <div className="u062-box">
                    <input
                      ref={emailInputRef}
                      id={`${uid}-email`}
                      type="email"
                      autoComplete="username"
                      spellCheck={false}
                      placeholder="Nhập email nhà trường"
                      value={email}
                      disabled={isBusyOrOk}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (badField) setBadField(null);
                      }}
                      aria-invalid={badField === 'email' || badField === 'both' || undefined}
                      required
                    />
                  </div>
                </div>

                <div
                  className={`u062-f u062-pw ${
                    badField === 'password' || badField === 'both' ? 'bad' : ''
                  }`}
                >
                  <label htmlFor={`${uid}-password`}>Mật khẩu</label>
                  <span className={`u062-caps ${capsLockOn ? 'on' : ''}`} aria-live="polite">
                    Caps Lock đang bật
                  </span>
                  <div className="u062-box">
                    <input
                      ref={passwordInputRef}
                      id={`${uid}-password`}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Nhập mật khẩu"
                      value={password}
                      disabled={isBusyOrOk}
                      onKeyUp={handlePasswordKey}
                      onKeyDown={handlePasswordKey}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (badField) setBadField(null);
                        if (passwordInlineError) setPasswordInlineError(null);
                      }}
                      aria-invalid={badField === 'password' || badField === 'both' || undefined}
                      aria-describedby={passwordInlineError ? `${uid}-pw-err` : undefined}
                      required
                    />
                    <button
                      type="button"
                      className="u062-eye"
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      aria-pressed={showPassword}
                      disabled={isBusyOrOk}
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <g className="u062-lid">
                          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </g>
                        <path className="u062-slash" d="M4 4l16 16" />
                      </svg>
                    </button>
                  </div>
                  <div className="u062-err">
                    <span id={`${uid}-pw-err`} role="alert">
                      {passwordInlineError ?? ''}
                    </span>
                  </div>
                </div>

                <div className="mb-3">
                  <MathCaptchaField
                    challenge={captcha}
                    value={captchaInput}
                    onChange={(nextValue) => {
                      setCaptchaInput(nextValue);
                      if (cooldownSeconds === 0 && captchaError) {
                        setCaptchaError(null);
                      }
                    }}
                    onRefresh={() => refreshCaptcha(cooldownSeconds === 0)}
                    error={captchaError}
                    disabled={isBusyOrOk}
                  />
                </div>

                <div className="u062-go-wrap">
                  <button
                    type="submit"
                    disabled={isBusyOrOk || cooldownSeconds > 0}
                    aria-busy={btnState === 'busy' || undefined}
                    aria-label={
                      btnState === 'busy'
                        ? 'Đang đăng nhập...'
                        : btnState === 'ok'
                          ? 'Đăng nhập thành công'
                          : undefined
                    }
                    className={`u062-go ${btnState === 'busy' ? 'busy' : ''} ${
                      btnState === 'ok' ? 'ok' : ''
                    }`}
                  >
                    <span>
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      {cooldownSeconds > 0 ? `Thử lại sau ${cooldownSeconds}s` : 'Đăng nhập'}
                    </span>
                    <i aria-hidden="true" />
                    <svg className="u062-ck" viewBox="0 0 26 26" aria-hidden="true">
                      <path d="M6 13.5l4.5 4.5L20 8.5" />
                    </svg>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={openManualRecovery}
                  disabled={isBusyOrOk}
                  className="mt-4 inline-flex items-center justify-center gap-2 self-center text-xs font-semibold text-brand-navyText hover:underline disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  <span>Quên mật khẩu? Lấy mã qua email</span>
                </button>
              </form>
            </>
          )}

          <div className="mt-6 flex items-start gap-2 rounded-lg bg-surface-page p-4 text-xs font-normal text-ink-secondary">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-navy" aria-hidden="true" />
            <span>
              Tài khoản do nhà trường cấp, không hỗ trợ tự đăng ký. Nếu quên mật khẩu và không nhận
              được mã qua email, vui lòng liên hệ quản trị viên để được đặt lại.
            </span>
          </div>
        </div>

        <div className="u062-pane u062-hi" aria-hidden={!welcomeIn}>
          <span
            className={`u062-av ${isValidAvatarUrl(profile?.avatar_url) ? 'u062-av--photo' : ''}`}
            aria-hidden="true"
          >
            {isValidAvatarUrl(profile?.avatar_url) ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="u062-av-photo"
              />
            ) : (
              <>
                <img
                  src="/logo-light.png"
                  alt=""
                  className="h-full w-full object-contain dark:hidden"
                />
                <img
                  src="/logo-dark.png"
                  alt=""
                  className="hidden h-full w-full object-contain dark:block"
                />
              </>
            )}
          </span>
          <h2 className="u062-hi-title">
            {welcomeName ? `Chào mừng, ${welcomeName}` : 'Chào mừng trở lại'}
          </h2>
          {welcomeMeta && <p className="u062-hi-sub">{welcomeMeta}</p>}
          <button
            ref={enterBtnRef}
            type="button"
            tabIndex={welcomeIn ? 0 : -1}
            disabled={loading}
            onClick={handleEnterHome}
            className="u062-hi-btn"
          >
            <span>Vào trang chủ</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
