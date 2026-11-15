import { useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, className = '', ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-ink-primary">
          {label}
          {rest.required && <span className="ml-1 text-brand-red">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`h-10 w-full rounded-lg border bg-surface-card px-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-muted ${
          error ? 'border-brand-red' : 'border-line-strong'
        } ${className}`}
        {...rest}
      />
      {error && <p className="text-xs font-normal text-brand-red">{error}</p>}
      {!error && hint && <p className="text-xs font-normal text-ink-muted">{hint}</p>}
    </div>
  );
}

