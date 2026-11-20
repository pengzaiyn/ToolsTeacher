import { type ClipboardEvent, type CSSProperties, useEffect, useRef } from 'react';
import { sanitizeExamHtml } from '@/lib/examRichText';

interface RichTextEditableProps {
  html: string;
  editable: boolean;
  onChange: (nextHtml: string) => void;
  onFocusField?: () => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  tag?: 'div' | 'span';
}

/**
 * Ô văn bản định dạng trực tuyến (in đậm, nghiêng, gạch chân, màu chữ, chỉ số trên/dưới).
 * Giữ ổn định vị trí con trỏ khi đang gõ và tự động làm sạch HTML chống XSS.
 */
export function RichTextEditable({
  html,
  editable,
  onChange,
  onFocusField,
  placeholder = 'Nhấn để nhập nội dung...',
  className = '',
  style,
  ariaLabel,
  tag = 'div',
}: RichTextEditableProps) {
  const ref = useRef<HTMLElement | null>(null);
  const focusedRef = useRef(false);
  const lastCommittedRef = useRef(html);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!focusedRef.current && el.innerHTML !== html) {
      el.innerHTML = html;
      lastCommittedRef.current = html;
    }
  }, [html]);

  function commitCurrentHtml() {
    const el = ref.current;
    if (!el) return;
    const cleaned = sanitizeExamHtml(el.innerHTML);
    if (cleaned !== lastCommittedRef.current) {
      lastCommittedRef.current = cleaned;
      onChange(cleaned);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    if (typeof document.execCommand === 'function') {
      document.execCommand('insertText', false, text);
    }
  }

  if (!editable) {
    const safeHtml = sanitizeExamHtml(html);
    if (tag === 'span') {
      return (
        <span
          className={className}
          style={style}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      );
    }
    return (
      <div
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  const commonProps = {
    contentEditable: true,
    suppressContentEditableWarning: true,
    role: 'textbox' as const,
    'aria-label': ariaLabel,
    'data-placeholder': placeholder,
    style,
    className: `outline-none transition-colors rounded px-1 -mx-1 hover:bg-brand-navySoft/40 focus:bg-brand-navySoft/60 focus:ring-2 focus:ring-brand-navy/30 empty:before:content-[attr(data-placeholder)] empty:before:text-ink-muted empty:before:italic ${className}`,
    onFocus: () => {
      focusedRef.current = true;
      onFocusField?.();
    },
    onBlur: () => {
      focusedRef.current = false;
      commitCurrentHtml();
    },
    onInput: () => {
      commitCurrentHtml();
    },
    onPaste: handlePaste,
  };

  if (tag === 'span') {
    return (
      <span
        ref={(node) => {
          ref.current = node;
        }}
        {...commonProps}
      />
    );
  }

  return (
    <div
      ref={(node) => {
        ref.current = node;
      }}
      {...commonProps}
    />
  );
}

