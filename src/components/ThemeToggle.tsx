import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

/**
 * Nút chuyển nhanh giữa giao diện Sáng và Tối, dùng được trên thanh điều hướng, mobile và trang đăng nhập.
 */
export function ThemeToggle({ compact = false, className = '' }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
      title={isDark ? 'Đang bật chế độ Tối · Bấm để chuyển Sáng' : 'Đang bật chế độ Sáng · Bấm để chuyển Tối'}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface-page text-xs font-semibold text-ink-secondary transition-colors hover:border-line-strong hover:bg-surface-subtle hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${
        compact ? 'h-10 w-10' : 'h-8 px-2'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="h-4 w-4 shrink-0 text-status-warningText" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 shrink-0 text-brand-navy" aria-hidden="true" />
      )}
      {!compact && <span>{isDark ? 'Sáng' : 'Tối'}</span>}
    </button>
  );
}

