import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  clearFailedLoginAttempts,
  getRecoveryResendCooldown,
  normalizeRecoveryEmail,
  startRecoveryResendCooldown,
} from '@/lib/passwordRecovery';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type RecoveryStep = 'request' | 'verify_otp' | 'set_password';

interface PasswordRecoveryPanelProps {
  /** Email điền sẵn từ biểu mẫu đăng nhập */
  initialEmail?: string;
  /** Lý do mở luồng khôi phục (ví dụ khi nhập sai quá nhiều lần) */
  reasonMessage?: string | null;
  /** Có sẵn phiên PASSWORD_RECOVERY từ liên kết trong email hay không */
  hasRecoverySession?: boolean;
  /** Hoàn tất đặt lại mật khẩu thành công */
  onCompleted: (recoveredEmail: string) => void;
  /** Quay về biểu mẫu đăng nhập */
  onBackToLogin?: () => void;
}

/** Khung lấy lại mật khẩu bằng mã xác nhận OTP qua email hoặc liên kết khôi phục */
export function PasswordRecoveryPanel({
  initialEmail = '',
  reasonMessage,
  hasRecoverySession = false,
  onCompleted,
  onBackToLogin,
}: PasswordRecoveryPanelProps) {
  const {
    user,
    requestPasswordRecovery,
    verifyRecoveryOtp,
    completePasswordRecovery,
    cancelPasswordRecovery,
  } = useAuth();

  const [step, setStep] = useState<RecoveryStep>(() =>
    hasRecoverySession ? 'set_password' : 'request'
  );
  const [email, setEmail] = useState(() => initialEmail);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resendCooldown, setResendCooldown] = useState(() => getRecoveryResendCooldown());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  useEffect(() => {
    if (hasRecoverySession) {
      setStep('set_password');
      setError(null);
    }
  }, [hasRecoverySession]);

  useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [initialEmail, email]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  async function sendRecoveryCode() {
    setError(null);
    const normalized = normalizeRecoveryEmail(email);
    if (!normalized || !normalized.includes('@')) {
      setError('Vui lòng nhập địa chỉ email tài khoản hợp lệ.');
      return;
    }
    if (resendCooldown > 0) {
      setError(`Vui lòng chờ ${resendCooldown} giây trước khi gửi lại mã.`);
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordRecovery(normalized);
      const nextWait = startRecoveryResendCooldown();
      setResendCooldown(nextWait);
      setSentNotice(
        `Nếu tài khoản tồn tại và có hộp thư hoạt động, mã hoặc liên kết đặt lại mật khẩu đã được gửi tới ${normalized}. Vui lòng kiểm tra cả Hộp thư đến và Thư rác (Spam).`
      );
      setStep('verify_otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được email khôi phục.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestSubmit(event: FormEvent) {
    event.preventDefault();
    await sendRecoveryCode();
  }

  async function handleVerifyOtpSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const normalized = normalizeRecoveryEmail(email);
    const cleanedOtp = otpCode.trim();
    if (!normalized || !normalized.includes('@')) {
      setError('Email tài khoản không hợp lệ.');
      return;
    }
    if (!/^\d{6,8}$/.test(cleanedOtp)) {
      setError('Vui lòng nhập mã xác nhận gồm 6–8 chữ số nhận được trong email.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu mới cần ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      await verifyRecoveryOtp(normalized, cleanedOtp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mã xác nhận không hợp lệ hoặc đã hết hạn.');
      setSubmitting(false);
      return;
    }

    try {
      await completePasswordRecovery(newPassword);
      clearFailedLoginAttempts(normalized);
      onCompleted(normalized);
    } catch (err) {
      setStep('set_password');
      setError(err instanceof Error ? err.message : 'Không cập nhật được mật khẩu mới.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetPasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Mật khẩu mới cần ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      await completePasswordRecovery(newPassword);
      const targetEmail = normalizeRecoveryEmail(user?.email ?? email);
      if (targetEmail) {
        clearFailedLoginAttempts(targetEmail);
      }
      onCompleted(targetEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đặt lại được mật khẩu mới.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBack() {
    if (submitting) return;
    await cancelPasswordRecovery();
    onBackToLogin?.();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-navySoft text-brand-navy">
          {step === 'set_password' ? (
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          ) : (
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-brand-navy">
            {step === 'set_password' ? 'Đặt lại mật khẩu mới' : 'Khôi phục mật khẩu qua Email'}
          </h2>
          <p className="text-xs font-normal text-ink-secondary">
            {step === 'request' &&
              'Xác nhận email tài khoản để nhận mã xác minh hoặc liên kết đặt lại mật khẩu.'}
            {step === 'verify_otp' &&
              'Nhập mã xác minh từ email và đặt mật khẩu mới (tối thiểu 8 ký tự).'}
            {step === 'set_password' &&
              'Phiên xác minh qua email đã hợp lệ. Vui lòng tạo mật khẩu mới cho tài khoản.'}
          </p>
        </div>
      </div>

      {reasonMessage && step === 'request' && (
        <div
          role="status"
          className="rounded-lg border border-status-warningBorder bg-status-warningBg p-4 text-xs font-semibold text-status-warningText"
        >
          {reasonMessage}
        </div>
      )}

      {sentNotice && step === 'verify_otp' && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-status-successBorder bg-status-successBg p-4 text-xs font-normal text-status-successText"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{sentNotice}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-status-dangerBorder bg-status-dangerBg p-4 text-sm font-semibold text-status-dangerText"
        >
          {error}
        </div>
      )}

      {step === 'request' && (
        <form onSubmit={handleRequestSubmit} className="flex flex-col gap-4">
          <Input
            label="Email nhà trường cần khôi phục"
            type="email"
            autoComplete="email"
            placeholder="ten@caodangvietmyhanoi.edu.vn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={resendCooldown > 0}
            className="w-full"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>
              {resendCooldown > 0
                ? `Vui lòng chờ ${resendCooldown}s để gửi lại`
                : 'Gửi mã về email'}
            </span>
          </Button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep('verify_otp');
            }}
            className="self-center text-xs font-semibold text-brand-navyText hover:underline"
          >
            Đã có mã xác nhận trong email? Nhập mã ngay
          </button>
        </form>
      )}

      {step === 'verify_otp' && (
        <form onSubmit={handleVerifyOtpSubmit} className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-page p-4 text-xs">
            <div className="flex min-w-0 items-center gap-2 text-ink-secondary">
              <Mail className="h-4 w-4 shrink-0 text-brand-navy" aria-hidden="true" />
              <span className="truncate font-semibold text-ink-primary">
                {normalizeRecoveryEmail(email) || 'Chưa nhập email'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep('request');
              }}
              className="shrink-0 font-semibold text-brand-navyText hover:underline"
            >
              Đổi email
            </button>
          </div>

          <Input
            label="Mã xác nhận từ email"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Nhập mã số trong email (VD: 123456)"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            required
          />

          <Input
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            placeholder="Tối thiểu 8 ký tự"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <Input
            label="Nhập lại mật khẩu mới"
            type="password"
            autoComplete="new-password"
            placeholder="Nhập lại khớp mật khẩu mới"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <div className="flex flex-col gap-2">
            <Button type="submit" variant="primary" loading={submitting} className="w-full">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Xác nhận mã và đặt mật khẩu mới</span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={submitting || resendCooldown > 0}
              onClick={() => void sendRecoveryCode()}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>
                {resendCooldown > 0
                  ? `Gửi lại mã sau ${resendCooldown}s`
                  : 'Gửi lại mã về email'}
              </span>
            </Button>
          </div>
        </form>
      )}

      {step === 'set_password' && (
        <form onSubmit={handleSetPasswordSubmit} className="flex flex-col gap-4">
          <Input
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            placeholder="Tối thiểu 8 ký tự"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <Input
            label="Nhập lại mật khẩu mới"
            type="password"
            autoComplete="new-password"
            placeholder="Nhập lại khớp mật khẩu mới"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button type="submit" variant="primary" loading={submitting} className="w-full">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Lưu mật khẩu mới</span>
          </Button>
        </form>
      )}

      {onBackToLogin && (
        <div className="border-t border-line pt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() => void handleBack()}
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Quay lại đăng nhập</span>
          </Button>
        </div>
      )}
    </div>
  );
}

