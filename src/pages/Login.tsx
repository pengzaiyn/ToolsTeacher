import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, KeyRound, Lock, Mail } from 'lucide-react';
import { AuthSignInError, useAuth } from '@/context/AuthContext';
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
import { AmbientGlassBackdrop } from '@/components/AmbientGlassBackdrop';
import { CustomWallpaperBackdrop } from '@/components/custom-theme/CustomWallpaperBackdrop';
import { MathCaptchaField } from '@/components/MathCaptchaField';
import { PasswordRecoveryPanel } from '@/components/PasswordRecoveryPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/Spinner';

const MAX_CAPTCHA_ATTEMPTS = 5;
const CAPTCHA_COOLDOWN_SECONDS = 5;

interface LoginLocationState {
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
  const [submitting, setSubmitting] = useState(false);

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

  if (loading) {
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

  if (user && profile && !isPasswordRecovery) {
    return <Navigate to="/tools" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setCaptchaError(null);

    if (cooldownSeconds > 0) {
      setError(
        `Bạn đã nhập sai mã xác minh nhiều lần. Vui lòng chờ ${cooldownSeconds} giây rồi thử lại.`
      );
      return;
    }

    if (!email.trim() || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
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
    setSubmitting(true);
    const normalizedEmail = normalizeRecoveryEmail(email);

    try {
      await signIn(normalizedEmail, password);
      clearFailedLoginAttempts(normalizedEmail);
      navigate('/tools', { replace: true });
    } catch (err) {
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
          refreshCaptcha(true);
          return;
        }
        setError(
          `Email hoặc mật khẩu chưa đúng (lần sai ${nextAttempts}/${MAX_FAILED_LOGIN_ATTEMPTS}).`
        );
      } else {
        setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
      }
      refreshCaptcha(true);
    } finally {
      setSubmitting(false);
    }
  }

  function openManualRecovery() {
    setError(null);
    setSuccessNotice(null);
    setRecoveryEmail(normalizeRecoveryEmail(email));
    setRecoveryReason(null);
    setMode('recovery');
  }

  const displayError = error ?? authError;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-surface-page px-4 py-8">
      <CustomWallpaperBackdrop />
      <AmbientGlassBackdrop />
      <div className="fixed right-4 top-4 z-20">
        <ThemeToggle />
      </div>
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-surface-card p-6 shadow-sm sm:p-8">
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

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <Input
                  label="Email nhà trường"
                  type="email"
                  autoComplete="email"
                  placeholder="ten@caodangvietmyhanoi.edu.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <Input
                label="Mật khẩu"
                type="password"
                autoComplete="current-password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

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
                disabled={submitting}
              />

              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                disabled={cooldownSeconds > 0}
                className="mt-2 w-full"
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span>{cooldownSeconds > 0 ? `Thử lại sau ${cooldownSeconds}s` : 'Đăng nhập'}</span>
              </Button>

              <button
                type="button"
                onClick={openManualRecovery}
                className="inline-flex items-center justify-center gap-2 self-center text-xs font-semibold text-brand-navyText hover:underline"
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
    </div>
  );
}
