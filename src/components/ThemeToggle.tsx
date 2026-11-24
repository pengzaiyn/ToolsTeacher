// Lucian UX/UI Prompt #219 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#219
import type { MouseEvent } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

/**
 * Nút chuyển nhanh giữa giao diện Sáng và Tối với hiệu ứng lan tròn #219 từ đúng vị trí nút bấm.
 */
export function ThemeToggle({ compact = false, className = '' }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = resolvedTheme === 'dark';

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    toggleTheme({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isDark ? t('theme.toLight', 'Chuyển sang giao diện Sáng') : t('theme.toDark', 'Chuyển sang giao diện Tối')}
      title={isDark ? t('theme.toLight', 'Chuyển sang giao diện Sáng') : t('theme.toDark', 'Chuyển sang giao diện Tối')}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface-page text-xs font-semibold text-ink-secondary transition-colors hover:border-line-strong hover:bg-surface-subtle hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${
        compact ? 'h-9 w-9' : 'h-8 px-2.5'
      } ${className}`}
    >
      <span className="relative grid h-4 w-4 place-items-center">
        <Sun
          className={`col-start-1 row-start-1 h-4 w-4 text-status-warningText transition-all duration-500 ease-[cubic-bezier(0.3,1.4,0.5,1)] ${
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'
          }`}
          aria-hidden="true"
        />
        <Moon
          className={`col-start-1 row-start-1 h-4 w-4 text-brand-navy transition-all duration-500 ease-[cubic-bezier(0.3,1.4,0.5,1)] ${
            isDark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`}
          aria-hidden="true"
        />
      </span>
      {!compact && <span>{isDark ? t('theme.light', 'Sáng') : t('theme.dark', 'Tối')}</span>}
    </button>
  );
}
