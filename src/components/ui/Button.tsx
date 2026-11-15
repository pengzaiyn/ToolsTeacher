import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '@/components/ui/Spinner';

export type ButtonVariant = 'primary' | 'navy' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-red text-white hover:bg-brand-redHover border border-transparent',
  navy: 'bg-brand-navy text-white hover:bg-brand-navyHover border border-transparent',
  secondary: 'bg-surface-card text-ink-primary border border-line-strong hover:bg-surface-subtle',
  danger: 'bg-status-dangerSolid text-white hover:opacity-90 border border-transparent',
  ghost: 'bg-transparent text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary border border-transparent',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-4 text-xs',
  md: 'h-10 px-4 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

