import { useId, type SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  hint,
  options,
  placeholder,
  id,
  className = '',
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={selectId} className="text-sm font-semibold text-ink-primary">
          {label}
          {rest.required && <span className="ml-1 text-brand-red">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={`h-10 w-full rounded-lg border bg-surface-card px-4 text-sm font-normal text-ink-primary focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-muted ${
          error ? 'border-brand-red' : 'border-line-strong'
        } ${className}`}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs font-normal text-brand-red">{error}</p>}
      {!error && hint && <p className="text-xs font-normal text-ink-muted">{hint}</p>}
    </div>
  );
}

