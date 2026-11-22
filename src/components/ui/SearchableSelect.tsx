import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
}

interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  ariaLabel?: string;
  className?: string;
}

function stripVietnamese(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = '-- Chọn --',
  searchPlaceholder = 'Gõ để tìm kiếm...',
  emptyMessage = 'Không tìm thấy kết quả phù hợp',
  hint,
  error,
  required = false,
  disabled = false,
  allowClear = false,
  ariaLabel,
  className = '',
}: SearchableSelectProps) {
  const autoId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = stripVietnamese(query);
    if (!q) return options;
    return options.filter((opt) => {
      const haystack = stripVietnamese(
        `${opt.label} ${opt.description ?? ''} ${opt.searchText ?? ''}`
      );
      return haystack.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);

    const onMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-2 ${className}`}>
      {label && (
        <label htmlFor={autoId} className="text-sm font-semibold text-ink-primary">
          {label}
          {required && <span className="ml-1 text-brand-red">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          id={autoId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel || label || placeholder}
          onClick={() => {
            if (!disabled) {
              setOpen((prev) => !prev);
              setQuery('');
            }
          }}
          className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-surface-card px-4 text-left text-sm transition-colors focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-muted ${
            error ? 'border-brand-red' : 'border-line-strong'
          }`}
        >
          <span
            className={`min-w-0 flex-1 truncate ${
              selectedOption ? 'font-normal text-ink-primary' : 'font-normal text-ink-muted'
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {allowClear && value && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Xóa lựa chọn"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange('');
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </span>
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-line-strong bg-surface-card shadow-xl"
          >
            <div className="border-b border-line bg-surface-page p-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full rounded-lg border border-line-strong bg-surface-card pl-9 pr-3 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                />
              </div>
              {query.trim() && (
                <p className="mt-1 px-1 text-[11px] font-normal text-ink-muted">
                  Tìm thấy {filteredOptions.length} / {options.length} mục
                </p>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto p-1">
              {allowClear && !query.trim() && (
                <button
                  type="button"
                  role="option"
                  aria-selected={value === ''}
                  onClick={() => handleSelect('')}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    value === ''
                      ? 'bg-brand-navySoft font-semibold text-brand-navy'
                      : 'text-ink-muted hover:bg-surface-subtle hover:text-ink-primary'
                  }`}
                >
                  <span className="truncate">{placeholder}</span>
                  {value === '' && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </button>
              )}

              {filteredOptions.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs font-normal text-ink-muted">
                  {emptyMessage}
                </p>
              ) : (
                filteredOptions.map((opt) => {
                  const selected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelect(opt.value)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? 'bg-brand-navySoft font-semibold text-brand-navy'
                          : 'font-normal text-ink-primary hover:bg-surface-subtle'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{opt.label}</p>
                        {opt.description && (
                          <p className="truncate text-xs font-normal text-ink-muted">
                            {opt.description}
                          </p>
                        )}
                      </div>
                      {selected && (
                        <Check className="h-4 w-4 shrink-0 text-brand-navy" aria-hidden="true" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs font-normal text-brand-red">{error}</p>}
      {!error && hint && <p className="text-xs font-normal text-ink-muted">{hint}</p>}
    </div>
  );
}
