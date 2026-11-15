import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return <Loader2 className={`animate-spin ${SIZE_CLASSES[size]} ${className}`} aria-hidden="true" />;
}

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Đang tải dữ liệu...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-line bg-surface-card p-8 text-center">
      <Spinner size="lg" className="text-brand-navy" />
      <p className="text-sm font-normal text-ink-secondary">{message}</p>
    </div>
  );
}

