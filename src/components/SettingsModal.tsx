import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettingsModal } from '@/context/SettingsModalContext';
import { SettingsPanel, useResetAppearanceSettings } from '@/components/SettingsPanel';
import { Button } from '@/components/ui/Button';

/**
 * Khung Cài đặt nổi trên màn hình có nút X để đóng và nền mờ nhẹ giúp xem trước hiệu ứng trực tiếp trên trang bên dưới.
 */
export function SettingsModal() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { isOpen, activeTab, setActiveTab, closeSettings } = useSettingsModal();
  const handleReset = useResetAppearanceSettings();

  const visible = isOpen && Boolean(user) && pathname !== '/settings';

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSettings();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [visible, closeSettings]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink-card/20 p-4 sm:p-6 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={closeSettings}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-line bg-surface-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-navySoft text-brand-navy">
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="settings-modal-title"
                className="truncate text-lg font-bold text-brand-navy sm:text-xl"
              >
                Cài đặt giao diện
              </h2>
              <p className="hidden truncate text-xs font-normal text-ink-secondary sm:block">
                Xem thay đổi trực tiếp trên trang bên dưới và đóng lại mà không mất trạng thái đang xem
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              aria-label="Khôi phục cài đặt giao diện mặc định"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Khôi phục mặc định</span>
              <span className="sm:hidden">Mặc định</span>
            </Button>

            <button
              type="button"
              onClick={closeSettings}
              aria-label="Đóng cài đặt"
              title="Đóng (Esc)"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-page text-ink-secondary transition-colors hover:bg-surface-subtle hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-surface-page p-4 sm:p-6">
          <SettingsPanel
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            stickyNavTopClass="lg:top-0"
          />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-line bg-surface-card px-4 py-4 sm:px-6">
          <span className="text-xs font-normal text-ink-muted">
            Mọi thay đổi được lưu tự động và giữ nguyên trang bạn đang mở
          </span>
          <Button variant="navy" size="sm" onClick={closeSettings}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}

