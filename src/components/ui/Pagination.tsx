// Lucian UX/UI Prompt #449 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#449
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import './lucian-449.css';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  className?: string;
}

type SlotVal = number | '';

interface SlotTransition {
  current: SlotVal;
  exiting: SlotVal | null;
  rev: number;
  back: boolean;
}

function buildSlots(cur: number, total: number): SlotVal[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (cur <= 4) return [1, 2, 3, 4, 5, '', total];
  if (cur >= total - 3) return [1, '', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '', cur - 1, cur, cur + 1, '', total];
}

export function Pagination({ page, totalPages, onPageChange, className = '' }: PaginationProps) {
  const { lang, t } = useLanguage();
  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.max(1, Math.min(safeTotal, page));

  const slots = useMemo(() => buildSlots(safePage, safeTotal), [safePage, safeTotal]);
  const activeSlotIndex = Math.max(0, slots.indexOf(safePage));

  const pillRef = useRef<HTMLSpanElement>(null);
  const prevPageRef = useRef(safePage);
  const exitTimerRef = useRef<number | undefined>(undefined);

  const [slotStates, setSlotStates] = useState<SlotTransition[]>(() =>
    slots.map((v) => ({ current: v, exiting: null, rev: 0, back: false }))
  );

  useEffect(() => {
    const back = safePage < prevPageRef.current;

    if (prevPageRef.current !== safePage && pillRef.current) {
      pillRef.current.classList.remove('is-sq');
      void pillRef.current.offsetWidth;
      pillRef.current.classList.add('is-sq');
    }
    prevPageRef.current = safePage;

    setSlotStates((prev) =>
      slots.map((v, idx) => {
        const old = prev[idx];
        if (!old) {
          return { current: v, exiting: null, rev: 0, back: false };
        }
        if (old.current === v) {
          return old;
        }
        return {
          current: v,
          exiting: old.current,
          rev: old.rev + 1,
          back,
        };
      })
    );

    window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = window.setTimeout(() => {
      setSlotStates((prev) =>
        prev.map((s) => (s.exiting !== null ? { ...s, exiting: null } : s))
      );
    }, 320);

    return () => {
      window.clearTimeout(exitTimerRef.current);
    };
  }, [safePage, slots]);

  if (safeTotal <= 1) return null;

  const formatPageLabel = (n: number) => {
    if (lang === 'zh') return `第 ${n} 页`;
    if (lang === 'en') return `Page ${n}`;
    return `Trang ${n}`;
  };

  const go = (next: number) => {
    const clamped = Math.max(1, Math.min(safeTotal, next));
    if (clamped !== safePage) {
      onPageChange(clamped);
    }
  };

  return (
    <div className={`ux u449 ${className}`}>
      <nav className="u449-nav" aria-label={t('pagination.nav', 'Phân trang')}>
        <button
          type="button"
          className="u449-ar"
          aria-label={t('pagination.prev', 'Trang trước')}
          disabled={safePage === 1}
          onClick={() => go(safePage - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>

        <div className="u449-sl" style={{ '--slots': slots.length } as CSSProperties}>
          <span
            ref={pillRef}
            className="u449-pill"
            aria-hidden="true"
            style={{ '--x': `${activeSlotIndex * 34}px` } as CSSProperties}
          />
          {slots.map((v, idx) => {
            const st = slotStates[idx];
            const isDots = v === '';
            const isCurrent = v === safePage;
            return (
              <button
                key={idx}
                type="button"
                className={`u449-n ${isDots ? 'is-dots' : ''} ${st?.back ? 'is-back' : ''}`}
                aria-hidden={isDots || undefined}
                tabIndex={isDots ? -1 : 0}
                aria-label={isDots ? undefined : formatPageLabel(v)}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => {
                  if (!isDots) go(v);
                }}
              >
                {st?.exiting !== null && st?.exiting !== undefined && (
                  <span key={`out-${st.rev}`} className="is-out">
                    {st.exiting === '' ? '…' : st.exiting}
                  </span>
                )}
                <span key={`in-${st?.rev ?? 0}`} className={st && st.rev > 0 ? 'is-in' : undefined}>
                  {isDots ? '…' : v}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="u449-ar"
          aria-label={t('pagination.next', 'Trang sau')}
          disabled={safePage === safeTotal}
          onClick={() => go(safePage + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
      <p className="u449-live" role="status">
        {formatPageLabel(safePage)}
      </p>
    </div>
  );
}
