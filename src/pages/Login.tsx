import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/Spinner';

export function Login() {
  const { user, profile, loading, authError, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page p-6">
        <div className="w-full max-w-sm">
          <LoadingState message="Đang tải hệ thống..." />
        </div>
      </div>
    );
  }

  if (user && profile) {
    return <Navigate to="/tools" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate('/tools', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
    } finally {
      setSubmitting(false);
    }
  }

  const displayError = error ?? authError;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-page px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-red text-white shadow-sm">
            <GraduationCap className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-brand-navy">AVC Connect</h1>
            <p className="text-sm font-normal text-ink-secondary">
              Cổng công cụ Trường Cao đẳng Việt Mỹ Hà Nội
            </p>
          </div>
        </div>

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

          <Button type="submit" variant="primary" loading={submitting} className="mt-2 w-full">
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span>Đăng nhập</span>
          </Button>
        </form>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-surface-page p-4 text-xs font-normal text-ink-secondary">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-navy" aria-hidden="true" />
          <span>
            Tài khoản do nhà trường cấp, không hỗ trợ tự đăng ký. Nếu quên mật khẩu, vui lòng liên
            hệ quản trị viên để được đặt lại.
          </span>
        </div>
      </div>
    </div>
  );
}
