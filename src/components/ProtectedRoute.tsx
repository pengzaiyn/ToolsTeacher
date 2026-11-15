import type { ReactNode } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LoadingState } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import type { UserRole } from '@/types/database';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading, isPasswordRecovery } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page p-6">
        <div className="w-full max-w-sm">
          <LoadingState message="Đang kiểm tra phiên đăng nhập..." />
        </div>
      </div>
    );
  }

  if (isPasswordRecovery) {
    return <Navigate to="/reset-password" replace />;
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-page p-6">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-line bg-surface-card p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-redSoft text-brand-red">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-ink-primary">Không có quyền truy cập</h1>
          <p className="text-sm font-normal text-ink-secondary">
            Tài khoản của bạn không được cấp quyền sử dụng trang này.
          </p>
          <Link to="/tools">
            <Button variant="navy">Quay về trang công cụ</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

