import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-line-strong bg-surface-card p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-navySoft text-brand-navy">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h3 className="text-base font-semibold text-ink-primary">{title}</h3>
        {description && <p className="text-sm font-normal text-ink-secondary">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

