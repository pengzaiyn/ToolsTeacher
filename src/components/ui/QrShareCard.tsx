// Lucian UX/UI Prompt #478 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#478
import { useEffect, useRef, useState } from 'react';
import { Copy, QrCode } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import './lucian-478.css';

interface QrShareCardProps {
  url: string;
  qrDataUrl: string | null;
  displayLabel?: string;
  altText?: string;
  size?: 'md' | 'lg';
  onCopied?: () => void;
}

export function QrShareCard({
  url,
  qrDataUrl,
  displayLabel,
  altText = 'Mã QR',
  size = 'md',
  onCopied,
}: QrShareCardProps) {
  const { t } = useLanguage();
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io.disconnect();
            setInView(true);
          }
        },
        { threshold: 0.25 }
      );
      io.observe(root);
      return () => io.disconnect();
    }

    setInView(true);
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  function handleCopy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        void navigator.clipboard.writeText(url).catch(() => {});
      }
    } catch {
      // Bỏ qua nếu clipboard bị chặn
    }

    setCopied(false);
    window.clearTimeout(copyTimerRef.current);
    window.requestAnimationFrame(() => {
      setCopied(true);
      onCopied?.();
    });

    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 2200);
  }

  const label = displayLabel ?? url.replace(/^https?:\/\//, '');

  return (
    <div ref={rootRef} className={`ux u478 ${inView ? 'is-in' : ''}`}>
      <section className={`u478-c ${size === 'lg' ? 'is-large is-scan' : ''}`}>
        <div className="u478-q">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={altText} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-muted">
              <QrCode className="h-10 w-10" aria-hidden="true" />
            </div>
          )}
          <span className="u478-br" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="u478-sc" aria-hidden="true">
            <i />
          </span>
        </div>

        <p className="u478-u" title={url}>
          {label}
        </p>

        <button
          type="button"
          className={`u478-cp ${copied ? 'is-ok' : ''}`}
          onClick={handleCopy}
        >
          <span>
            <Copy aria-hidden="true" />
            {t('qr.copyLink', 'Sao chép link')}
          </span>
          <span>
            <svg className="ck" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8.5l3.2 3.2L13 4.8" />
            </svg>
            {t('qr.copied', 'Đã sao chép')}
          </span>
        </button>
      </section>
      <p className="u478-live" role="status">
        {copied ? t('qr.copied', 'Đã sao chép') : ''}
      </p>
    </div>
  );
}

