import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ToolItem } from '@/lib/toolsCatalog';
import { Badge } from '@/components/ui/Badge';

interface ToolCardProps {
  tool: ToolItem;
  ctaLabel?: string;
}

export function ToolCard({ tool, ctaLabel = 'Mở công cụ' }: ToolCardProps) {
  const Icon = tool.icon;
  const iconBg =
    tool.accent === 'red'
      ? 'bg-brand-redSoft text-brand-red'
      : 'bg-brand-navySoft text-brand-navy';

  return (
    <Link
      to={tool.to}
      className="group flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface-card p-6 transition-all hover:border-brand-navy hover:shadow-md"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          {tool.badge && (
            <Badge tone={tool.accent === 'red' ? 'red' : 'navy'}>{tool.badge}</Badge>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-bold text-ink-primary group-hover:text-brand-navy">
            {tool.title}
          </h3>
          <p className="text-sm font-normal leading-relaxed text-ink-secondary">
            {tool.description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
        <span>{ctaLabel}</span>
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

