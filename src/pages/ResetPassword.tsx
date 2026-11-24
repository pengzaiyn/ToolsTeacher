import { Navigate, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CustomWallpaperBackdrop } from '@/components/custom-theme/CustomWallpaperBackdrop';
import { PasswordRecoveryPanel } from '@/components/PasswordRecoveryPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

/** Trang đặt lại / khôi phục mật khẩu qua mã OTP hoặc liên kết gửi về email */
export function ResetPassword() {
  const { user, profile, loading, isPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page p-6">
        <div className="w-full max-w-sm">
          <LoadingState message="Đang xác thực phiên khôi phục..." />
        </div>
      </div>
    );
  }

  if (user && profile && !isPasswordRecovery) {
    return <Navigate to="/tools" replace />;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-surface-page px-4 py-8">
      <CustomWallpaperBackdrop />
      <div className="fixed right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-surface-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <div className="flex w-full items-center justify-center">
            <img
              src="/logo-light.png"
              alt="Trường Cao đẳng Việt Mỹ Hà Nội"
              className="h-20 w-auto max-w-full object-contain dark:hidden sm:h-24"
            />
            <img
              src="/logo-dark.png"
              alt="Trường Cao đẳng Việt Mỹ Hà Nội"
              className="hidden h-20 w-auto max-w-full object-contain dark:block sm:h-24"
            />
          </div>
          <h1 className="sr-only">Khôi phục mật khẩu Trường Cao đẳng Việt Mỹ Hà Nội</h1>
        </div>

        <PasswordRecoveryPanel
          hasRecoverySession={isPasswordRecovery}
          onCompleted={(recoveredEmail) => {
            toast.success('Đã đặt lại mật khẩu mới thành công');
            navigate('/login', {
              replace: true,
              state: {
                recoveredEmail,
                recoverySuccess:
                  'Đã đặt lại mật khẩu mới thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
              },
            });
          }}
          onBackToLogin={() => navigate('/login', { replace: true })}
        />

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-surface-page p-4 text-xs font-normal text-ink-secondary">
          <Mail className="h-4 w-4 shrink-0 text-brand-navy" aria-hidden="true" />
          <span>
            Nếu hộp thư không nhận được mã (do email tài khoản chưa có hộp thư thật), vui lòng liên hệ
            quản trị viên nhà trường để được đặt lại mật khẩu.
          </span>
        </div>
      </div>
    </div>
  );
}
