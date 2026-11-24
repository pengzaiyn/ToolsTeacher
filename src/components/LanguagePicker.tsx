// Lucian UX/UI Prompt #448 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#448
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useLanguage, type AppLanguage } from '@/context/LanguageContext';
import './lucian-448.css';

interface LanguageOption {
  id: AppLanguage;
  code: string;
  label: string;
  htmlLang: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: 'vi', code: 'VI', label: 'Tiếng Việt', htmlLang: 'vi' },
  { id: 'en', code: 'EN', label: 'English', htmlLang: 'en' },
  { id: 'zh', code: 'ZH', label: '简体中文', htmlLang: 'zh-Hans' },
];

interface LanguagePickerProps {
  compact?: boolean;
}

export function LanguagePicker({ compact = false }: LanguagePickerProps) {
  const { lang, setLang, t } = useLanguage();
  const uid = useId().replace(/:/g, '');
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const labelBoxRef = useRef<HTMLSpanElement>(null);
  const globeRef = useRef<HTMLSpanElement>(null);

  const curIndex = Math.max(
    0,
    LANGUAGE_OPTIONS.findIndex((o) => o.id === lang)
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(curIndex);
  const [exitingOption, setExitingOption] = useState<LanguageOption | null>(null);
  const [enteringKey, setEnteringKey] = useState<string | null>(null);
  const [liveMsg, setLiveMsg] = useState('');
  const exitTimerRef = useRef<number | undefined>(undefined);

  const currentOption = LANGUAGE_OPTIONS[curIndex];

  const fitWidth = () => {
    const lb = labelBoxRef.current;
    if (!lb) return;
    const activeSpan = lb.querySelector<HTMLSpanElement>('span:not(.is-out)');
    if (activeSpan) {
      lb.style.width = `${activeSpan.offsetWidth}px`;
    }
  };

  useEffect(() => {
    fitWidth();
    if (document.fonts && document.fonts.ready) {
      void document.fonts.ready.then(fitWidth);
    }
  }, [lang]);

  useEffect(() => {
    const handleOutside = (e: PointerEvent) => {
      if (open && wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutside, true);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  function openMenu() {
    setActiveIndex(curIndex);
    setOpen(true);
    window.setTimeout(() => listRef.current?.focus({ preventScroll: true }), 0);
  }

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) {
      btnRef.current?.focus({ preventScroll: true });
    }
  }

  function pickOption(nextIndex: number) {
    closeMenu(true);
    const next = LANGUAGE_OPTIONS[nextIndex];
    if (!next || next.id === lang) return;

    setExitingOption(currentOption);
    setEnteringKey(`${next.id}-${Date.now()}`);
    setLang(next.id);
    setLiveMsg(`${t('lang.changed')} ${next.label}`);

    window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = window.setTimeout(() => {
      setExitingOption(null);
    }, 420);

    const globe = globeRef.current;
    if (globe) {
      globe.classList.remove('is-spin');
      void globe.offsetWidth;
      globe.classList.add('is-spin');
    }
  }

  function handleButtonKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu();
    }
  }

  function handleListKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const total = LANGUAGE_OPTIONS.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + total) % total);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(total - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pickOption(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeMenu(true);
    } else if (e.key === 'Tab') {
      closeMenu(false);
    }
  }

  const clipId = `${uid}c`;
  const listId = `${uid}p`;

  return (
    <div ref={rootRef} className={`ux u448 ${open ? 'is-open' : ''}`}>
      <div ref={wrapRef} className="u448-w">
        <button
          ref={btnRef}
          type="button"
          className="u448-b"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${t('lang.label')}: ${currentOption.label}`}
          onClick={() => (open ? closeMenu() : openMenu())}
          onKeyDown={handleButtonKeyDown}
        >
          <span ref={globeRef} className="u448-g" aria-hidden="true">
            <svg viewBox="0 0 22 22">
              <defs>
                <clipPath id={clipId}>
                  <circle cx="11" cy="11" r="8.6" />
                </clipPath>
              </defs>
              <circle cx="11" cy="11" r="8.6" />
              <g clipPath={`url(#${clipId})`}>
                <g className="mer">
                  <path d="M-13 2.4c-4.2 2.6-4.2 14.6 0 17.2M-13 2.4c4.2 2.6 4.2 14.6 0 17.2M-5 2.4c-4.2 2.6-4.2 14.6 0 17.2M-5 2.4c4.2 2.6 4.2 14.6 0 17.2M3 2.4c-4.2 2.6-4.2 14.6 0 17.2M3 2.4c4.2 2.6 4.2 14.6 0 17.2M11 2.4c-4.2 2.6-4.2 14.6 0 17.2M11 2.4c4.2 2.6 4.2 14.6 0 17.2M19 2.4c-4.2 2.6-4.2 14.6 0 17.2M19 2.4c4.2 2.6 4.2 14.6 0 17.2M27 2.4c-4.2 2.6-4.2 14.6 0 17.2M27 2.4c4.2 2.6 4.2 14.6 0 17.2" />
                </g>
                <path d="M2.6 8.2h16.8M2.6 13.8h16.8" />
              </g>
            </svg>
          </span>

          {!compact && (
            <>
              <span ref={labelBoxRef} className="u448-lb">
                {exitingOption && (
                  <span key={`out-${exitingOption.id}`} lang={exitingOption.htmlLang} className="is-out">
                    {exitingOption.label}
                  </span>
                )}
                <span
                  key={enteringKey ?? currentOption.id}
                  lang={currentOption.htmlLang}
                  className={enteringKey ? 'is-in' : undefined}
                >
                  {currentOption.label}
                </span>
              </span>

              <svg className="u448-cv" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 4.6 6 7.6l3-3" />
              </svg>
            </>
          )}
        </button>

        <ul
          ref={listRef}
          id={listId}
          className="u448-p"
          role="listbox"
          aria-label={t('lang.label')}
          aria-activedescendant={open ? `${uid}o${activeIndex}` : undefined}
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
        >
          {LANGUAGE_OPTIONS.map((opt, idx) => (
            <li
              key={opt.id}
              id={`${uid}o${idx}`}
              className={`u448-o ${open && activeIndex === idx ? 'is-act' : ''}`}
              role="option"
              lang={opt.htmlLang}
              aria-selected={opt.id === lang}
              style={{ '--i': idx } as CSSProperties}
              onClick={() => pickOption(idx)}
              onPointerEnter={() => {
                if (open) setActiveIndex(idx);
              }}
            >
              <span>{opt.label}</span>
              <em>{opt.code}</em>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 8.5l3 3 6-6.5" />
              </svg>
            </li>
          ))}
        </ul>
      </div>
      <p className="u448-live" role="status">
        {liveMsg}
      </p>
    </div>
  );
}

