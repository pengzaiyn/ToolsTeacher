import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'navy' | 'red' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-subtle text-ink-secondary border-line',
  navy: 'bg-brand-navySoft text-brand-navy border-brand-navy/20',
  red: 'bg-brand-redSoft text-brand-red border-brand-red/20',
  success: 'bg-status-successBg text-status-successText border-status-successBorder',
  warning: 'bg-status-warningBg text-status-warningText border-status-warningBorder',
  danger: 'bg-status-dangerBg text-status-dangerText border-status-dangerBorder',
};

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

