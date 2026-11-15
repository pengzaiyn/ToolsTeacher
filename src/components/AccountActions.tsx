import { useState } from 'react';
import { KeyRound, Lock, Unlock } from 'lucide-react';
import { manageUsers } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

interface AccountActionsProps {
  account: Pick<Profile, 'id' | 'full_name' | 'is_active'>;
  onUpdated: () => void | Promise<void>;
}

export function AccountActions({ account, onUpdated }: AccountActionsProps) {
  const toast = useToast();
  const [confirmMode, setConfirmMode] = useState<'toggle' | 'reset' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!confirmMode) return;
    setSubmitting(true);
    try {
      if (confirmMode === 'toggle') {
        const nextActive = !account.is_active;
        await manageUsers({
          action: 'set_active',
          user_id: account.id,
          is_active: nextActive,
        });
        toast.success(
          nextActive
            ? `Đã mở khóa tài khoản ${account.full_name}`
            : `Đã khóa tài khoản ${account.full_name}`
        );
      } else {
        await manageUsers({
          action: 'reset_password',
          user_id: account.id,
        });
        toast.success(`Đã đặt lại mật khẩu cho ${account.full_name} về mật khẩu mặc định`);
      }
      setConfirmMode(null);
      await onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thực hiện được thao tác');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setConfirmMode('toggle')}
          title={account.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
        >
          {account.is_active ? (
            <>
              <Lock className="h-4 w-4 text-brand-red" aria-hidden="true" />
              <span>Khóa</span>
            </>
          ) : (
            <>
              <Unlock className="h-4 w-4 text-status-successText" aria-hidden="true" />
              <span>Mở khóa</span>
            </>
          )}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setConfirmMode('reset')}
          title="Đặt lại mật khẩu về mặc định"
        >
          <KeyRound className="h-4 w-4 text-brand-navy" aria-hidden="true" />
          <span>Đặt lại MK</span>
        </Button>
      </div>

      <ConfirmDialog
        open={confirmMode === 'toggle'}
        onClose={() => setConfirmMode(null)}
        onConfirm={handleConfirm}
        loading={submitting}
        confirmVariant={account.is_active ? 'danger' : 'navy'}
        confirmLabel={account.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
        title={account.is_active ? 'Xác nhận khóa tài khoản' : 'Xác nhận mở khóa tài khoản'}
        message={
          account.is_active
            ? `Tài khoản của ${account.full_name} sẽ không thể đăng nhập cho đến khi được mở khóa lại.`
            : `Bạn muốn mở khóa để ${account.full_name} đăng nhập lại vào hệ thống?`
        }
      />

      <ConfirmDialog
        open={confirmMode === 'reset'}
        onClose={() => setConfirmMode(null)}
        onConfirm={handleConfirm}
        loading={submitting}
        confirmVariant="navy"
        confirmLabel="Đặt lại mật khẩu"
        title="Xác nhận đặt lại mật khẩu"
        message={`Mật khẩu của ${account.full_name} sẽ được đặt lại về mật khẩu mặc định của hệ thống.`}
      />
    </>
  );
}

