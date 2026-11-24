// Lucian UX/UI Prompt #431 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#431
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Calendar, X } from 'lucide-react';
import { useLanguage, type AppLanguage } from '@/context/LanguageContext';
import './lucian-431.css';

interface DatePickerProps {
  label?: string;
  value: string; // YYYY-MM-DD or ''
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  minDate?: string;
  maxDate?: string;
  clearable?: boolean;
  disabled?: boolean;
  required?: boolean;
  surface?: 'card' | 'page';
  className?: string;
}

const LOCALE_COPY: Record<
  AppLanguage,
  {
    months: string[];
    weekdays: string[];
    formatHead: (monthIndex: number, year: number) => string;
    today: string;
    clear: string;
    prevMonth: string;
    nextMonth: string;
    placeholder: string;
    datesLabel: string;
  }
> = {
  vi: {
    months: [
      'Tháng 1',
      'Tháng 2',
      'Tháng 3',
      'Tháng 4',
      'Tháng 5',
      'Tháng 6',
      'Tháng 7',
      'Tháng 8',
      'Tháng 9',
      'Tháng 10',
      'Tháng 11',
      'Tháng 12',
    ],
    weekdays: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
    formatHead: (m, y) => `Tháng ${m + 1}, ${y}`,
    today: 'Hôm nay',
    clear: 'Xóa ngày',
    prevMonth: 'Tháng trước',
    nextMonth: 'Tháng sau',
    placeholder: 'Chọn ngày...',
    datesLabel: 'Lịch chọn ngày',
  },
  en: {
    months: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    formatHead: (m, y) => `${LOCALE_COPY.en.months[m]} ${y}`,
    today: 'Today',
    clear: 'Clear',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    placeholder: 'Pick a date...',
    datesLabel: 'Dates',
  },
  zh: {
    months: [
      '1月',
      '2月',
      '3月',
      '4月',
      '5月',
      '6月',
      '7月',
      '8月',
      '9月',
      '10月',
      '11月',
      '12月',
    ],
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    formatHead: (m, y) => `${y}年 ${m + 1}月`,
    today: '今天',
    clear: '清除',
    prevMonth: '上个月',
    nextMonth: '下个月',
    placeholder: '选择日期...',
    datesLabel: '日期选择',
  },
};

function parseIso(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayKey(d: Date): number {
  return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
}

function formatDisplay(iso: string): string {
  const dt = parseIso(iso);
  if (!dt) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder,
  ariaLabel,
  minDate,
  maxDate,
  clearable = false,
  disabled = false,
  required = false,
  surface = 'card',
  className = '',
}: DatePickerProps) {
  const { lang } = useLanguage();
  const copy = LOCALE_COPY[lang];
  const uid = useId();

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const selectedDate = useMemo(() => parseIso(value), [value]);
  const minDt = useMemo(() => (minDate ? parseIso(minDate) : null), [minDate]);
  const maxDt = useMemo(() => (maxDate ? parseIso(maxDate) : null), [maxDate]);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => {
    const base = selectedDate ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [slideDir, setSlideDir] = useState<-1 | 0 | 1>(0);
  const [slideTick, setSlideTick] = useState(0);
  const [popPos, setPopPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<HTMLElement>(null);
  const prevViewMonthRef = useRef<number>(view.getFullYear() * 12 + view.getMonth());

  const updatePopoverPosition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const popW = 296;
    const popH = 330;
    const margin = 12;

    let left = rect.left;
    if (left + popW > window.innerWidth - margin) {
      left = Math.max(margin, rect.right - popW);
    }
    if (left < margin) left = margin;

    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= popH + 8 || spaceBelow >= rect.top
        ? Math.min(rect.bottom + 6, window.innerHeight - popH - margin)
        : Math.max(margin, rect.top - popH - 6);

    setPopPos({ top, left });
  }, []);

  const openPicker = useCallback(() => {
    if (disabled) return;
    const base = selectedDate ?? today;
    setView(new Date(base.getFullYear(), base.getMonth(), 1));
    setSlideDir(0);
    updatePopoverPosition();
    setOpen(true);
  }, [disabled, selectedDate, today, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onViewportChange = () => updatePopoverPosition();

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, updatePopoverPosition]);

  const inView = useCallback(
    (d: Date | null) =>
      !!d && d.getFullYear() === view.getFullYear() && d.getMonth() === view.getMonth(),
    [view]
  );

  // Sync #431 spring selection pill position
  useLayoutEffect(() => {
    if (!open) return;
    const selEl = selRef.current;
    const grid = gridRef.current;
    if (!selEl || !grid) return;

    const viewMonthKey = view.getFullYear() * 12 + view.getMonth();
    const monthChanged = prevViewMonthRef.current !== viewMonthKey;
    prevViewMonthRef.current = viewMonthKey;

    const activeBtn =
      selectedDate && inView(selectedDate)
        ? grid.querySelector<HTMLButtonElement>(`[data-day="${selectedDate.getDate()}"]`)
        : null;

    if (monthChanged) {
      selEl.classList.add('is-jump');
    }
    if (activeBtn) {
      selEl.style.setProperty('--sx', `${activeBtn.offsetLeft}px`);
      selEl.style.setProperty('--sy', `${activeBtn.offsetTop}px`);
    }
    selEl.style.setProperty('--ss', activeBtn ? '1' : '0');
    if (monthChanged) {
      void selEl.offsetWidth;
      selEl.classList.remove('is-jump');
    }
  }, [open, view, selectedDate, inView]);

  const isDateDisabled = useCallback(
    (d: Date) => {
      const k = dayKey(d);
      if (minDt && k < dayKey(minDt)) return true;
      if (maxDt && k > dayKey(maxDt)) return true;
      return false;
    },
    [minDt, maxDt]
  );

  const shiftMonth = useCallback((delta: -1 | 1) => {
    setView((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setSlideDir(delta);
    setSlideTick((t) => t + 1);
  }, []);

  const pickDate = useCallback(
    (d: Date) => {
      if (isDateDisabled(d)) return;
      onChange(toIso(d));

      const rm =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!rm && selRef.current) {
        selRef.current.animate(
          [
            { borderRadius: '50%', filter: 'brightness(1.15)' },
            { borderRadius: '50%', filter: 'none' },
          ],
          { duration: 360 }
        );
      }
    },
    [isDateDisabled, onChange]
  );

  const handleGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>('.u431-d');
    if (!target) return;
    const curDay = Number(target.dataset.day);
    if (!curDay) return;

    const cur = new Date(view.getFullYear(), view.getMonth(), curDay);
    let next: Date | null = null;
    const deltas: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    if (e.key in deltas) {
      next = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + deltas[e.key]);
    } else if (e.key === 'PageDown' || e.key === 'PageUp') {
      next = new Date(
        cur.getFullYear(),
        cur.getMonth() + (e.key === 'PageDown' ? 1 : -1),
        Math.min(cur.getDate(), 28)
      );
    } else {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (minDt && dayKey(next) < dayKey(minDt)) next = new Date(minDt);
    if (maxDt && dayKey(next) > dayKey(maxDt)) next = new Date(maxDt);

    const dir =
      next.getFullYear() * 12 + next.getMonth() - (view.getFullYear() * 12 + view.getMonth());
    if (dir !== 0) {
      setView(new Date(next.getFullYear(), next.getMonth(), 1));
      setSlideDir(dir > 0 ? 1 : -1);
      setSlideTick((t) => t + 1);
    }
    pickDate(next);
    const targetDay = next.getDate();
    window.requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${targetDay}"]`)?.focus({
        preventScroll: true,
      });
    });
  };

  const cells = useMemo(() => {
    const y = view.getFullYear();
    const m = view.getMonth();
    const firstOffset = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const items: Array<Date | null> = [];
    for (let i = 0; i < 42; i++) {
      const day = i - firstOffset + 1;
      items.push(day >= 1 && day <= daysInMonth ? new Date(y, m, day) : null);
    }
    return items;
  }, [view]);

  const canPrevMonth = useMemo(() => {
    if (!minDt) return true;
    const prevEnd = new Date(view.getFullYear(), view.getMonth(), 0);
    return dayKey(prevEnd) >= dayKey(minDt);
  }, [view, minDt]);

  const canNextMonth = useMemo(() => {
    if (!maxDt) return true;
    const nextStart = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    return dayKey(nextStart) <= dayKey(maxDt);
  }, [view, maxDt]);

  const displayValue = formatDisplay(value);
  const bgClass = surface === 'page' ? 'bg-surface-page' : 'bg-surface-card';

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <label htmlFor={uid} className="text-sm font-semibold text-ink-primary">
          {label}
          {required && <span className="ml-1 text-brand-red">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        <button
          ref={triggerRef}
          id={uid}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={ariaLabel ?? label ?? copy.placeholder}
          onClick={() => (open ? setOpen(false) : openPicker())}
          className={`flex h-10 w-full items-center gap-2.5 rounded-lg border border-line-strong ${bgClass} px-3 text-left text-sm font-normal transition-colors focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:cursor-not-allowed disabled:opacity-60 ${
            open ? 'border-brand-navy ring-2 ring-brand-navy/20' : ''
          }`}
        >
          <Calendar className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <span
            className={`min-w-0 flex-1 truncate tabular-nums ${
              displayValue ? 'text-ink-primary' : 'text-ink-muted'
            }`}
          >
            {displayValue || placeholder || copy.placeholder}
          </span>
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label={copy.clear}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink-primary"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          )}
        </button>
      </div>

      {open &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={ariaLabel ?? label ?? copy.datesLabel}
            className="ux u431-pop"
            style={{ top: popPos.top, left: popPos.left }}
          >
            <div className="u431-c">
              <div className="u431-hd">
                <b aria-live="polite">{copy.formatHead(view.getMonth(), view.getFullYear())}</b>
                <button
                  type="button"
                  className="u431-nav"
                  disabled={!canPrevMonth}
                  aria-label={copy.prevMonth}
                  onClick={() => shiftMonth(-1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m14.5 6-6 6 6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="u431-nav"
                  disabled={!canNextMonth}
                  aria-label={copy.nextMonth}
                  onClick={() => shiftMonth(1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9.5 6 6 6-6 6" />
                  </svg>
                </button>
              </div>

              <div className="u431-wk" aria-hidden="true">
                {copy.weekdays.map((wd, idx) => (
                  <span key={`${wd}-${idx}`}>{wd}</span>
                ))}
              </div>

              <div className="u431-gw">
                <i ref={selRef} className="u431-sel" aria-hidden="true" />
                <div
                  key={slideTick}
                  ref={gridRef}
                  role="grid"
                  aria-label={copy.datesLabel}
                  onKeyDown={handleGridKeyDown}
                  className={`u431-g ${slideDir > 0 ? 'is-l' : slideDir < 0 ? 'is-r' : ''}`}
                >
                  {cells.map((cell, idx) => {
                    if (!cell) {
                      return <span key={`empty-${idx}`} role="gridcell" />;
                    }
                    const dNum = cell.getDate();
                    const isToday = dayKey(cell) === dayKey(today);
                    const isSelected = !!selectedDate && dayKey(cell) === dayKey(selectedDate);
                    const cellDisabled = isDateDisabled(cell);
                    const isFocusable =
                      isSelected ||
                      (!inView(selectedDate) && isToday) ||
                      (!inView(selectedDate) && !inView(today) && dNum === 1);

                    return (
                      <button
                        key={toIso(cell)}
                        type="button"
                        role="gridcell"
                        className="u431-d"
                        data-day={dNum}
                        tabIndex={isFocusable && !cellDisabled ? 0 : -1}
                        aria-selected={isSelected}
                        aria-current={isToday ? 'date' : undefined}
                        disabled={cellDisabled}
                        onClick={() => pickDate(cell)}
                      >
                        {dNum}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="u431-ft">
                <button
                  type="button"
                  className="u431-ft-btn"
                  disabled={isDateDisabled(today)}
                  onClick={() => {
                    setView(new Date(today.getFullYear(), today.getMonth(), 1));
                    pickDate(today);
                  }}
                >
                  {copy.today}
                </button>
                {clearable && value && (
                  <button
                    type="button"
                    className="u431-ft-btn u431-ft-clear"
                    onClick={() => {
                      onChange('');
                    }}
                  >
                    {copy.clear}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
